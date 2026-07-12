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
// -> 204 (always; we never leak whether the email is known)
// Side effect: a magic_links row is created for `email`.
// ---------------------------------------------------------------------------

describe("POST /auth/request", () => {
  it("returns 204 and creates a magic_links row", async () => {
    const res = await harness.api("POST", "/auth/request", {
      body: { email: "ada@example.com" },
    });
    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    const row = harness.sqlOne<{
      email: string;
      token: string;
      consumed_at: number | null;
    }>(
      "SELECT email, token, consumed_at FROM magic_links WHERE email = ?;",
      "ada@example.com",
    );
    expect(row).not.toBeNull();
    expect(row?.email).toBe("ada@example.com");
    expect(row?.token.length).toBe(64); // 32 random bytes hex-encoded
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
    const token = before!.token;

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
    return row!.token;
  }

  it("returns 200 with session_token and user; consumes the link; mints a session", async () => {
    const token = await mintToken("ada@example.com");
    const res = await harness.api<{
      session_token: string;
      user: { id: number; email: string; display_name: string | null };
    }>("POST", "/auth/verify", { body: { token } });

    expect(res.status).toBe(200);
    expect(res.json!.session_token.length).toBe(64);
    expect(res.json!.user).toEqual({
      id: expect.any(Number),
      email: "ada@example.com",
      display_name: null,
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
      res.json!.session_token,
    );
    expect(session?.user_id).toBe(res.json!.user.id);
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

    expect(first.json!.user.id).toBe(second.json!.user.id);
  });

  it("returns 400 when the token was already used", async () => {
    const token = await mintToken("ada@example.com");
    await harness.api("POST", "/auth/verify", { body: { token } });

    const res = await harness.api("POST", "/auth/verify", { body: { token } });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("already used"),
    });
  });

  it("returns 400 for an unknown token", async () => {
    const res = await harness.api("POST", "/auth/verify", {
      body: { token: "not-a-token" },
    });
    expect(res.status).toBe(400);
    expect(res.json).toMatchObject({
      error: expect.stringContaining("invalid or unknown"),
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
    const res = await harness.api<{ session_token: string }>(
      "POST",
      "/auth/verify",
      {
        body: { token: link!.token },
      },
    );
    return res.json!.session_token;
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
    const res = await harness.api<{ session_token: string }>(
      "POST",
      "/auth/verify",
      {
        body: { token: link!.token },
      },
    );
    return res.json!.session_token;
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
      display_name: null,
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
