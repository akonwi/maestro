import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { createHarness } from "../test-support/harness";

const harness = createHarness({ id: "auth", port: 8092 });

beforeAll(async () => {
  await harness.setup();
});
afterAll(async () => {
  await harness.teardown();
});
beforeEach(() => {
  // Clean slate per test so unrelated tests can't affect each other.
  harness.resetDb();
});

// ---------------------------------------------------------------------------
// POST /auth/request
// Body: { email }
// -> 200 { attempt_id, claim_token, expires_in }
// Side effect: linked login_attempts + magic_links rows are created.
// ---------------------------------------------------------------------------

describe("POST /auth/request", () => {
  it("returns claim credentials and creates a linked login attempt", async () => {
    const res = await harness.api<{
      attempt_id: string;
      claim_token: string;
      expires_in: number;
    }>("POST", "/auth/request", { body: { email: "ada@example.com" } });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      attempt_id: expect.any(String),
      claim_token: expect.any(String),
      expires_in: 900,
    });
    expect(res.json?.attempt_id.length).toBe(32);
    expect(res.json?.claim_token.length).toBe(64);

    const row = harness.sqlOne<{
      email: string;
      magic_token: string;
      code: string;
      claim_token: string;
      consumed_at: number | null;
    }>(
      "SELECT la.email, la.magic_token, la.code, la.claim_token, ml.consumed_at FROM login_attempts la JOIN magic_links ml ON ml.token = la.magic_token WHERE la.id = ?;",
      res.json?.attempt_id,
    );
    expect(row).not.toBeNull();
    expect(row?.email).toBe("ada@example.com");
    expect(row?.magic_token.length).toBe(64);
    expect(row?.code).toMatch(/^\d{6}$/);
    expect(row?.claim_token).toBe(res.json?.claim_token);
    expect(row?.consumed_at).toBeNull();
  });

  it("returns 400 when the body is missing", async () => {
    const res = await harness.api("POST", "/auth/request");
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "empty request body" });
  });

  it("returns 400 when the JSON is malformed", async () => {
    const res = await harness.api("POST", "/auth/request", {
      body: "not json",
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("invalid request"),
    });
  });

  it("returns 400 when the email field is missing", async () => {
    const res = await harness.api("POST", "/auth/request", { body: {} });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({ error: expect.stringContaining("email") });
  });
});

type LoginAttempt = {
  attempt_id: string;
  claim_token: string;
  expires_in: number;
};

type CompletedLogin = {
  status: "complete";
  session_token: string;
  user: { id: number; email: string; display_name: string | null };
};

async function requestAttempt(email = "ada@example.com") {
  const res = await harness.api<LoginAttempt>("POST", "/auth/request", {
    body: { email },
  });
  if (!res.json) throw new Error("login attempt was not created");
  return res.json;
}

// ---------------------------------------------------------------------------
// POST /auth/attempt/claim and /auth/attempt/code
// The claim endpoint polls the server-mediated handoff. The code endpoint is
// a rate-limited fallback that completes the same attempt in its origin app.
// ---------------------------------------------------------------------------

describe("login-attempt handoff", () => {
  it("stays pending until its email link is verified", async () => {
    const attempt = await requestAttempt();

    const pending = await harness.api<{ status: string }>(
      "POST",
      "/auth/attempt/claim",
      { body: attempt },
    );
    expect(pending.status).toBe(202);
    expect(pending.json).toEqual({ status: "pending" });

    const row = harness.sqlOne<{ magic_token: string }>(
      "SELECT magic_token FROM login_attempts WHERE id = ?;",
      attempt.attempt_id,
    );
    if (!row) throw new Error("login attempt row was not created");
    const verified = await harness.api<{ session_token: string }>(
      "POST",
      "/auth/verify",
      { body: { token: row.magic_token } },
    );
    expect(verified.status).toBe(200);

    const claimed = await harness.api<CompletedLogin>(
      "POST",
      "/auth/attempt/claim",
      { body: attempt },
    );
    expect(claimed.status).toBe(200);
    expect(claimed.json).toEqual({
      status: "complete",
      session_token: verified.json?.session_token,
      user: {
        id: expect.any(Number),
        email: "ada@example.com",
        display_name: "ada",
      },
    });
  });

  it("completes in the originating app with the emailed code", async () => {
    const attempt = await requestAttempt();
    const row = harness.sqlOne<{ code: string }>(
      "SELECT code FROM login_attempts WHERE id = ?;",
      attempt.attempt_id,
    );
    if (!row) throw new Error("login attempt row was not created");

    const completed = await harness.api<CompletedLogin>(
      "POST",
      "/auth/attempt/code",
      { body: { ...attempt, code: row.code } },
    );
    expect(completed.status).toBe(200);
    expect(completed.json?.status).toBe("complete");
    expect(completed.json?.session_token).toBeString();
    expect(completed.json?.user.email).toBe("ada@example.com");
    const sessionToken = completed.json?.session_token;

    // A response can be lost after the server commits. Retrying returns the
    // same session instead of consuming the attempt a second time.
    const retried = await harness.api<CompletedLogin>(
      "POST",
      "/auth/attempt/code",
      { body: { ...attempt, code: row.code } },
    );
    expect(retried.status).toBe(200);
    expect(retried.json?.session_token).toBe(sessionToken);
  });

  it("retires the alternate magic link after code redemption", async () => {
    const attempt = await requestAttempt();
    const row = harness.sqlOne<{ code: string; magic_token: string }>(
      "SELECT code, magic_token FROM login_attempts WHERE id = ?;",
      attempt.attempt_id,
    );
    if (!row) throw new Error("login attempt row was not created");

    const completed = await harness.api<CompletedLogin>(
      "POST",
      "/auth/attempt/code",
      { body: { ...attempt, code: row.code } },
    );
    expect(completed.status).toBe(200);

    const verified = await harness.api("POST", "/auth/verify", {
      body: { token: row.magic_token },
    });
    expect(verified.status).toBe(400);
    expect(
      harness.sqlOne<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sessions;",
      )?.count,
    ).toBe(1);
  });

  it("cannot resurrect a code-created session with the magic link after logout", async () => {
    const attempt = await requestAttempt();
    const row = harness.sqlOne<{ code: string; magic_token: string }>(
      "SELECT code, magic_token FROM login_attempts WHERE id = ?;",
      attempt.attempt_id,
    );
    if (!row) throw new Error("login attempt row was not created");

    const completed = await harness.api<CompletedLogin>(
      "POST",
      "/auth/attempt/code",
      { body: { ...attempt, code: row.code } },
    );
    if (!completed.json) throw new Error("login attempt was not completed");
    const loggedOut = await harness.api("POST", "/auth/logout", {
      body: {},
      headers: { Authorization: `Bearer ${completed.json.session_token}` },
    });
    expect(loggedOut.status).toBe(204);

    const verified = await harness.api("POST", "/auth/verify", {
      body: { token: row.magic_token },
    });
    expect(verified.status).toBe(400);
    expect(
      harness.sqlOne<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sessions;",
      )?.count,
    ).toBe(0);
  });

  it("treats expiry while retiring the magic link as an invalid code", async () => {
    const attempt = await requestAttempt();
    const row = harness.sqlOne<{ code: string; magic_token: string }>(
      "SELECT code, magic_token FROM login_attempts WHERE id = ?;",
      attempt.attempt_id,
    );
    if (!row) throw new Error("login attempt row was not created");
    harness.sqlOne(
      "UPDATE magic_links SET expires_at = 0 WHERE token = ? RETURNING token;",
      row.magic_token,
    );

    const completed = await harness.api("POST", "/auth/attempt/code", {
      body: { ...attempt, code: row.code },
    });
    expect(completed.status).toBe(400);
    expect(completed.json).toEqual({
      error: "verification code is invalid or expired",
    });
    expect(
      harness.sqlOne<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sessions;",
      )?.count,
    ).toBe(0);
  });

  it("mints at most one session when code and link verification race", async () => {
    const attempt = await requestAttempt();
    const row = harness.sqlOne<{ code: string; magic_token: string }>(
      "SELECT code, magic_token FROM login_attempts WHERE id = ?;",
      attempt.attempt_id,
    );
    if (!row) throw new Error("login attempt row was not created");

    const [codeResult, linkResult] = await Promise.all([
      harness.api<CompletedLogin>("POST", "/auth/attempt/code", {
        body: { ...attempt, code: row.code },
      }),
      harness.api<{ session_token: string }>("POST", "/auth/verify", {
        body: { token: row.magic_token },
      }),
    ]);

    expect([200, 400]).toContain(codeResult.status);
    expect([200, 400]).toContain(linkResult.status);
    expect(codeResult.status === 200 || linkResult.status === 200).toBe(true);
    expect(
      harness.sqlOne<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sessions;",
      )?.count,
    ).toBe(1);

    const returnedTokens = [
      codeResult.json?.session_token,
      linkResult.json?.session_token,
    ].filter((token): token is string => Boolean(token));
    expect(new Set(returnedTokens).size).toBe(1);

    const claimed = await harness.api<CompletedLogin>(
      "POST",
      "/auth/attempt/claim",
      { body: attempt },
    );
    expect(claimed.status).toBe(200);
    expect(claimed.json?.session_token).toBe(returnedTokens[0]);
  });

  it("rejects claims made without the private claim token", async () => {
    const attempt = await requestAttempt();
    const res = await harness.api("POST", "/auth/attempt/claim", {
      body: { ...attempt, claim_token: "wrong" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "login attempt is invalid or expired",
    });
  });

  it("locks the fallback code after five incorrect guesses", async () => {
    const attempt = await requestAttempt();
    const row = harness.sqlOne<{ code: string }>(
      "SELECT code FROM login_attempts WHERE id = ?;",
      attempt.attempt_id,
    );
    if (!row) throw new Error("login attempt row was not created");

    for (let i = 0; i < 5; i += 1) {
      const rejected = await harness.api("POST", "/auth/attempt/code", {
        body: { ...attempt, code: "wrong" },
      });
      expect(rejected.status).toBe(400);
    }
    expect(
      harness.sqlOne<{ code_attempts: number }>(
        "SELECT code_attempts FROM login_attempts WHERE id = ?;",
        attempt.attempt_id,
      )?.code_attempts,
    ).toBe(5);

    const locked = await harness.api("POST", "/auth/attempt/code", {
      body: { ...attempt, code: row.code },
    });
    expect(locked.status).toBe(400);
    expect(locked.json).toEqual({
      error: "verification code is invalid or expired",
    });
  });

  it("rejects an expired attempt", async () => {
    const attempt = await requestAttempt();
    harness.sqlOne(
      "UPDATE login_attempts SET expires_at = 0 WHERE id = ? RETURNING id;",
      attempt.attempt_id,
    );
    const res = await harness.api("POST", "/auth/attempt/claim", {
      body: attempt,
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "login attempt is invalid or expired",
    });
  });
});

// ---------------------------------------------------------------------------
// GET /auth/verify?token=X
// -> 302 to {APP_BASE_URL}/auth/verify?token=X
// Contract: this endpoint MUST NOT consume the token. Email prescanners
// follow links; only POST /auth/verify (called by the web app) consumes.
// ---------------------------------------------------------------------------

describe("GET /auth/verify?token=X", () => {
  it("redirects to the web app without consuming the token", async () => {
    // Mint a magic link first.
    await harness.api("POST", "/auth/request", {
      body: { email: "ada@example.com" },
    });
    const before = harness.sqlOne<{
      token: string;
      consumed_at: number | null;
    }>(
      "SELECT token, consumed_at FROM magic_links WHERE email = ?;",
      "ada@example.com",
    );
    const token = before?.token;

    const res = await harness.api("GET", `/auth/verify?token=${token}`);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      `http://web.test/auth/verify?token=${token}`,
    );

    const after = harness.sqlOne<{ consumed_at: number | null }>(
      "SELECT consumed_at FROM magic_links WHERE token = ?;",
      token,
    );
    expect(after?.consumed_at).toBeNull();
  });

  it("returns 400 when the token query param is missing", async () => {
    const res = await harness.api("GET", "/auth/verify");
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "missing token" });
  });
});

// ---------------------------------------------------------------------------
// POST /auth/verify
// Body: { token }
// -> 200 { session_token, user: { id, email, display_name } }
// Consumes the magic link (single-use). Creates or fetches the user.
// Mints a new session bearer token.
// ---------------------------------------------------------------------------

describe("POST /auth/verify", () => {
  async function mintToken(email: string): Promise<string> {
    await harness.api("POST", "/auth/request", { body: { email } });
    // A given email may accumulate several links across a single test
    // (already-consumed + freshly minted). Grab the newest, unused one.
    const row = harness.sqlOne<{ token: string }>(
      "SELECT token FROM magic_links WHERE email = ? AND consumed_at IS NULL ORDER BY expires_at DESC LIMIT 1;",
      email,
    );
    if (!row) throw new Error("magic link was not created");
    return row.token;
  }

  it("returns 200 with session_token and user; consumes the link; mints a session", async () => {
    const token = await mintToken("ada@example.com");
    const res = await harness.api<{
      session_token: string;
      user: { id: number; email: string; display_name: string | null };
    }>("POST", "/auth/verify", { body: { token } });

    expect(res.status).toBe(200);
    expect(res.json?.session_token.length).toBe(64);
    expect(res.json?.user).toEqual({
      id: expect.any(Number),
      email: "ada@example.com",
      display_name: "ada",
    });

    // Magic link consumed.
    const link = harness.sqlOne<{ consumed_at: number | null }>(
      "SELECT consumed_at FROM magic_links WHERE token = ?;",
      token,
    );
    expect(link?.consumed_at).toBeGreaterThan(0);

    // Session persisted.
    const session = harness.sqlOne<{ user_id: number }>(
      "SELECT user_id FROM sessions WHERE token = ?;",
      res.json?.session_token,
    );
    expect(session?.user_id).toBe(res.json?.user.id);
  });

  it("is idempotent per email: same email on second verify returns the same user id", async () => {
    const token1 = await mintToken("ada@example.com");
    const first = await harness.api<{ user: { id: number } }>(
      "POST",
      "/auth/verify",
      {
        body: { token: token1 },
      },
    );

    const token2 = await mintToken("ada@example.com");
    const second = await harness.api<{ user: { id: number } }>(
      "POST",
      "/auth/verify",
      {
        body: { token: token2 },
      },
    );

    expect(first.json?.user.id).toBe(second.json?.user.id);
  });

  it("returns 400 when the token was already used", async () => {
    const token = await mintToken("ada@example.com");
    await harness.api("POST", "/auth/verify", { body: { token } });

    const res = await harness.api("POST", "/auth/verify", { body: { token } });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "sign-in link is invalid or expired",
    });
  });

  it("returns 400 for an unknown token", async () => {
    const res = await harness.api("POST", "/auth/verify", {
      body: { token: "not-a-token" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({
      error: "sign-in link is invalid or expired",
    });
  });

  it("returns 400 when the body is missing", async () => {
    const res = await harness.api("POST", "/auth/verify");
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: "empty request body" });
  });
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// Header: Authorization: Bearer <session_token>
// -> 204; deletes the session.
// Missing / malformed bearer -> 401.
// Unknown token -> 204 (delete is idempotent; nothing to leak).
// ---------------------------------------------------------------------------

describe("POST /auth/logout", () => {
  async function newSession(email: string): Promise<string> {
    await harness.api("POST", "/auth/request", { body: { email } });
    const link = harness.sqlOne<{ token: string }>(
      "SELECT token FROM magic_links WHERE email = ? AND consumed_at IS NULL ORDER BY expires_at DESC LIMIT 1;",
      email,
    );
    if (!link) throw new Error("magic link was not created");
    const res = await harness.api<{ session_token: string }>(
      "POST",
      "/auth/verify",
      {
        body: { token: link.token },
      },
    );
    if (!res.json) throw new Error("session was not created");
    return res.json.session_token;
  }

  it("returns 204 and deletes the session", async () => {
    const sessionToken = await newSession("ada@example.com");

    const res = await harness.api("POST", "/auth/logout", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    expect(res.status).toBe(204);

    const row = harness.sqlOne(
      "SELECT token FROM sessions WHERE token = ?;",
      sessionToken,
    );
    expect(row).toBeNull();
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const res = await harness.api("POST", "/auth/logout");
    expect(res.status).toBe(401);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("bearer"),
    });
  });

  it("returns 401 when the Authorization scheme is not Bearer", async () => {
    const res = await harness.api("POST", "/auth/logout", {
      headers: { Authorization: "Basic abc" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 204 for an unknown bearer (delete is idempotent)", async () => {
    const res = await harness.api("POST", "/auth/logout", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    expect(res.status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// Header: Authorization: Bearer <session_token>
// -> 200 current user. Missing, unknown, or expired sessions -> 401.
// ---------------------------------------------------------------------------

describe("GET /auth/me", () => {
  async function newSession(email: string): Promise<string> {
    await harness.api("POST", "/auth/request", { body: { email } });
    const link = harness.sqlOne<{ token: string }>(
      "SELECT token FROM magic_links WHERE email = ? AND consumed_at IS NULL ORDER BY expires_at DESC LIMIT 1;",
      email,
    );
    if (!link) throw new Error("magic link was not created");
    const res = await harness.api<{ session_token: string }>(
      "POST",
      "/auth/verify",
      {
        body: { token: link.token },
      },
    );
    if (!res.json) throw new Error("session was not created");
    return res.json.session_token;
  }

  it("returns the current user for a valid session", async () => {
    const token = await newSession("ada@example.com");
    const res = await harness.api<{
      id: number;
      email: string;
      display_name: string | null;
    }>("GET", "/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({
      id: expect.any(Number),
      email: "ada@example.com",
      display_name: "ada",
    });
  });

  it("returns 401 without a bearer token", async () => {
    const res = await harness.api("GET", "/auth/me");
    expect(res.status).toBe(401);
    expect(res.json).toEqual({
      error: "missing, invalid, or expired bearer token",
    });
  });

  it("returns 401 for an unknown bearer token", async () => {
    const res = await harness.api("GET", "/auth/me", {
      headers: { Authorization: "Bearer unknown" },
    });
    expect(res.status).toBe(401);
  });

  it("returns 401 for an expired session", async () => {
    const token = await newSession("ada@example.com");
    harness.sqlOne(
      "UPDATE sessions SET expires_at = 0 WHERE token = ? RETURNING token;",
      token,
    );

    const res = await harness.api("GET", "/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    expect(
      harness.sqlOne("SELECT token FROM sessions WHERE token = ?;", token),
    ).not.toBeNull();
  });
});
