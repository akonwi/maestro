import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { createHarness } from "../test-support/harness";

const harness = createHarness({ id: "health", port: 8091 });

beforeAll(async () => {
  await harness.setup();
});
afterAll(async () => {
  await harness.teardown();
});

describe("GET /health", () => {
  it("returns 200 ok when the database is reachable", async () => {
    const res = await harness.api("GET", "/health");
    expect(res.status).toBe(200);
    expect(res.text).toBe("ok");
  });
});
