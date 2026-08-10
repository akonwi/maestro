import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createHarness } from "../test-support/harness";

// The harness runs with a dummy API-Football key, so every upstream
// fetch fails. The feed's contract is per-competition degradation:
// failing leagues are skipped (logged), and the endpoint still returns
// 200 with an array rather than an upstream error.
const harness = createHarness({ id: "feed", port: 8093 });

beforeAll(async () => {
  await harness.setup();
});
afterAll(async () => {
  await harness.teardown();
});

describe("GET /fixtures/feed", () => {
  it("returns 200 with an array even when upstream leagues fail", async () => {
    const res = await harness.api<unknown[]>("GET", "/fixtures/feed");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.json)).toBe(true);
    expect(res.json?.length).toBe(0);
  });
});
