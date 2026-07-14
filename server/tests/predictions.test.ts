import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createHarness } from "../test-support/harness";

const harness = createHarness({ id: "predictions", port: 8097 });

beforeAll(async () => {
  await harness.setup();
});
afterAll(async () => {
  await harness.teardown();
});
beforeEach(() => {
  harness.resetDb();
});

async function sessionFor(email: string): Promise<{ token: string; userId: number }> {
  await harness.api("POST", "/auth/request", { body: { email } });
  const link = harness.sqlOne<{ token: string }>(
    "SELECT token FROM magic_links WHERE email = ? AND consumed_at IS NULL ORDER BY expires_at DESC LIMIT 1;",
    email,
  );
  const verified = await harness.api<{ session_token: string; user: { id: number } }>(
    "POST",
    "/auth/verify",
    { body: { token: link!.token } },
  );
  return { token: verified.json!.session_token, userId: verified.json!.user.id };
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("predictions", () => {
  it("returns the current user's prediction", async () => {
    const user = await sessionFor("ada@example.com");
    harness.sqlOne(
      "INSERT INTO predictions (user_id, fixture_id, home_score, away_score, created_at, updated_at) VALUES (?, 100, 2, 1, 1, 1) RETURNING id;",
      user.userId,
    );

    const response = await harness.api<any>("GET", "/fixtures/100/prediction", {
      headers: bearer(user.token),
    });
    expect(response.status).toBe(200);
    expect(response.json).toMatchObject({ fixture_id: 100, home_score: 2, away_score: 1 });
  });

  it("returns 404 when the current user has no prediction", async () => {
    const user = await sessionFor("ada@example.com");
    const response = await harness.api("GET", "/fixtures/100/prediction", {
      headers: bearer(user.token),
    });
    expect(response.status).toBe(404);
  });

  it("shows all member predictions immediately and excludes outsiders", async () => {
    const owner = await sessionFor("owner@example.com");
    const member = await sessionFor("member@example.com");
    const outsider = await sessionFor("outsider@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(owner.token),
      body: { name: "Sunday League" },
    });
    const groupId = created.json!.id;
    harness.sqlOne(
      "INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, 1) RETURNING user_id;",
      groupId,
      member.userId,
    );
    for (const [userId, home, away] of [
      [owner.userId, 2, 1],
      [member.userId, 1, 1],
      [outsider.userId, 0, 3],
    ]) {
      harness.sqlOne(
        "INSERT INTO predictions (user_id, fixture_id, home_score, away_score, created_at, updated_at) VALUES (?, 100, ?, ?, 1, 1) RETURNING id;",
        userId,
        home,
        away,
      );
    }

    const response = await harness.api<any[]>(
      "GET",
      `/groups/${groupId}/fixtures/100/predictions`,
      { headers: bearer(member.token) },
    );
    expect(response.status).toBe(200);
    expect(response.json).toHaveLength(2);
    expect(response.json!.map(prediction => prediction.user.email)).toEqual([
      "owner@example.com",
      "member@example.com",
    ]);
  });

  it("hides group predictions from non-members", async () => {
    const owner = await sessionFor("owner@example.com");
    const outsider = await sessionFor("outsider@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(owner.token),
      body: { name: "Sunday League" },
    });

    const response = await harness.api(
      "GET",
      `/groups/${created.json!.id}/fixtures/100/predictions`,
      { headers: bearer(outsider.token) },
    );
    expect(response.status).toBe(404);
  });

  it("validates scores before contacting the fixture provider", async () => {
    const user = await sessionFor("ada@example.com");
    const response = await harness.api("PUT", "/fixtures/100/prediction", {
      headers: bearer(user.token),
      body: { home_score: -1, away_score: 2 },
    });
    expect(response.status).toBe(400);
    expect(response.json).toEqual({ error: "scores must be between 0 and 99" });
  });
});
