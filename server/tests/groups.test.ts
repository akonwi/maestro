import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { createHarness } from "../test-support/harness";

const harness = createHarness({ id: "groups", port: 8096 });

beforeAll(async () => {
  await harness.setup();
});
afterAll(async () => {
  await harness.teardown();
});
beforeEach(() => {
  harness.resetDb();
});

async function sessionFor(email: string): Promise<string> {
  await harness.api("POST", "/auth/request", { body: { email } });
  const link = harness.sqlOne<{ token: string }>(
    "SELECT token FROM magic_links WHERE email = ? AND consumed_at IS NULL ORDER BY expires_at DESC LIMIT 1;",
    email,
  );
  const verified = await harness.api<{ session_token: string }>("POST", "/auth/verify", {
    body: { token: link!.token },
  });
  return verified.json!.session_token;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("groups", () => {
  it("creates a group with the owner as its first member", async () => {
    const token = await sessionFor("owner@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(token),
      body: { name: " Sunday League " },
    });

    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({
      name: "Sunday League",
      member_count: 1,
      owner_id: expect.any(Number),
    });

    const groups = await harness.api<any[]>("GET", "/groups", {
      headers: bearer(token),
    });
    expect(groups.status).toBe(200);
    expect(groups.json).toHaveLength(1);
  });

  it("lets any member invite another person by email", async () => {
    const ownerToken = await sessionFor("owner@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(ownerToken),
      body: { name: "Sunday League" },
    });
    const groupId = created.json!.id;

    const firstInvite = await harness.api<any>("POST", `/groups/${groupId}/invites`, {
      headers: bearer(ownerToken),
      body: { email: "friend@example.com" },
    });
    expect(firstInvite.status).toBe(200);
    expect(firstInvite.json).toMatchObject({
      member: { email: "friend@example.com" },
      member_added: true,
      invitation_sent: false, // outbound email is disabled in tests
    });

    // Invited users already exist and are members. Signing in finds that
    // same user, then they can invite another person themselves.
    const friendToken = await sessionFor("friend@example.com");
    const secondInvite = await harness.api<any>("POST", `/groups/${groupId}/invites`, {
      headers: bearer(friendToken),
      body: { email: "third@example.com" },
    });
    expect(secondInvite.status).toBe(200);

    const detail = await harness.api<any>("GET", `/groups/${groupId}`, {
      headers: bearer(friendToken),
    });
    expect(detail.status).toBe(200);
    expect(detail.json!.group.member_count).toBe(3);
    expect(detail.json!.members.map((member: any) => member.email)).toEqual([
      "owner@example.com",
      "friend@example.com",
      "third@example.com",
    ]);
  });

  it("makes repeated invitations idempotent", async () => {
    const token = await sessionFor("owner@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(token),
      body: { name: "Sunday League" },
    });
    const path = `/groups/${created.json!.id}/invites`;

    await harness.api("POST", path, {
      headers: bearer(token),
      body: { email: "friend@example.com" },
    });
    await harness.api("POST", path, {
      headers: bearer(token),
      body: { email: "friend@example.com" },
    });

    const count = harness.sqlOne<{ count: number }>(
      "SELECT COUNT(*) AS count FROM group_members WHERE group_id = ?;",
      created.json!.id,
    );
    expect(count?.count).toBe(2);
  });

  it("hides groups from non-members", async () => {
    const ownerToken = await sessionFor("owner@example.com");
    const outsiderToken = await sessionFor("outsider@example.com");
    const created = await harness.api<any>("POST", "/groups", {
      headers: bearer(ownerToken),
      body: { name: "Sunday League" },
    });

    const detail = await harness.api("GET", `/groups/${created.json!.id}`, {
      headers: bearer(outsiderToken),
    });
    const invite = await harness.api("POST", `/groups/${created.json!.id}/invites`, {
      headers: bearer(outsiderToken),
      body: { email: "friend@example.com" },
    });
    expect(detail.status).toBe(404);
    expect(invite.status).toBe(404);
  });

  it("requires authentication and validates input", async () => {
    expect((await harness.api("GET", "/groups")).status).toBe(401);

    const token = await sessionFor("owner@example.com");
    const empty = await harness.api("POST", "/groups", {
      headers: bearer(token),
      body: { name: "   " },
    });
    expect(empty.status).toBe(400);
  });
});
