import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createHarness } from "../test-support/harness";

const harness = createHarness({ id: "leaderboards", port: 8098 });

beforeAll(async () => harness.setup());
afterAll(async () => harness.teardown());
beforeEach(() => harness.resetDb());

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

describe("season leaderboard", () => {
  it("ranks scored predictions and includes members without scores", async () => {
    const owner = await sessionFor("owner@example.com");
    const tied = await sessionFor("tied@example.com");
    const zero = await sessionFor("zero@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(owner.token),
      body: { name: "Friends" },
    });
    const groupId = created.json!.id;
    for (const userId of [tied.userId, zero.userId]) {
      harness.sqlOne(
        "INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, 1) RETURNING user_id;",
        groupId,
        userId,
      );
    }
    harness.sqlOne(
      "INSERT INTO fixture_scoring_state (fixture_id, competition_id, kickoff_at, prediction_lock_at, state, provider_status, next_check_at, attempt_count, created_at, updated_at) VALUES (600, 1, 1, 1, 'settled', 'FT', NULL, 0, 1, 1) RETURNING fixture_id;",
    );
    for (const userId of [owner.userId, tied.userId]) {
      harness.sqlOne(
        "INSERT INTO predictions (user_id, fixture_id, home_score, away_score, points, created_at, updated_at) VALUES (?, 600, 2, 1, 3, 1, 1) RETURNING id;",
        userId,
      );
    }

    const response = await harness.api<any[]>(
      "GET",
      `/groups/${groupId}/leaderboard/season`,
      { headers: bearer(owner.token) },
    );
    expect(response.status).toBe(200);
    expect(response.json).toHaveLength(3);
    expect(response.json!.map(entry => [entry.rank, entry.total_points])).toEqual([
      [1, 3],
      [1, 3],
      [3, 0],
    ]);
    expect(response.json![2]).toMatchObject({ exact_count: 0, outcome_count: 0, played: 0 });
  });

  it("filters weekly standings using Tuesday morning boundaries", async () => {
    const owner = await sessionFor("owner@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(owner.token),
      body: { name: "Friends" },
    });
    harness.sqlOne(
      "INSERT INTO fixture_scoring_state (fixture_id, competition_id, kickoff_at, prediction_lock_at, state, provider_status, next_check_at, attempt_count, created_at, updated_at) VALUES (610, 1, 1772535600000, 1, 'settled', 'FT', NULL, 0, 1, 1) RETURNING fixture_id;",
    );
    harness.sqlOne(
      "INSERT INTO predictions (user_id, fixture_id, home_score, away_score, points, created_at, updated_at) VALUES (?, 610, 2, 1, 3, 1, 1) RETURNING id;",
      owner.userId,
    );
    const response = await harness.api<any[]>(
      "GET",
      `/groups/${created.json!.id}/leaderboard/week?week=2026-03-03`,
      { headers: bearer(owner.token) },
    );
    expect(response.status).toBe(200);
    expect(response.json![0]).toMatchObject({ total_points: 3, exact_count: 1, played: 1 });
  });

  it("rejects a weekly key that is not Tuesday", async () => {
    const owner = await sessionFor("owner@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(owner.token),
      body: { name: "Friends" },
    });
    const response = await harness.api(
      "GET",
      `/groups/${created.json!.id}/leaderboard/week?week=2026-03-04`,
      { headers: bearer(owner.token) },
    );
    expect(response.status).toBe(400);
    expect(response.json).toEqual({ error: "week must be a Tuesday" });
  });

  it("hides standings from non-members", async () => {
    const owner = await sessionFor("owner@example.com");
    const outsider = await sessionFor("outsider@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(owner.token),
      body: { name: "Friends" },
    });
    const response = await harness.api(
      "GET",
      `/groups/${created.json!.id}/leaderboard/season`,
      { headers: bearer(outsider.token) },
    );
    expect(response.status).toBe(404);
  });

  it("validates the competition filter", async () => {
    const owner = await sessionFor("owner@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(owner.token),
      body: { name: "Friends" },
    });
    const response = await harness.api(
      "GET",
      `/groups/${created.json!.id}/leaderboard/season?competition_id=nope`,
      { headers: bearer(owner.token) },
    );
    expect(response.status).toBe(400);
    expect(response.json).toEqual({ error: "competition_id must be an integer" });
  });
});
