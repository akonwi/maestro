import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { createHarness } from "../test-support/harness";

const ADMIN_TOKEN = "test-admin-token";
const harness = createHarness({
  id: "admin",
  port: 8095,
  env: { ADMIN_TOKEN },
});

const authed = { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } };

beforeAll(async () => {
  await harness.setup();
});
afterAll(async () => {
  await harness.teardown();
});
beforeEach(() => {
  harness.resetDb();
});

type Competition = {
  id: number;
  api_football_league_id: number;
  name: string;
  kind: string;
  is_active: boolean;
};

describe("admin competitions", () => {
  it("rejects requests without the admin token", async () => {
    const list = await harness.api("GET", "/admin/competitions");
    expect(list.status).toBe(401);

    const create = await harness.api("POST", "/admin/competitions", {
      body: { api_football_league_id: 39, name: "Premier League" },
    });
    expect(create.status).toBe(401);
  });

  it("rejects a wrong token", async () => {
    const res = await harness.api("GET", "/admin/competitions", {
      headers: { Authorization: "Bearer not-the-token" },
    });
    expect(res.status).toBe(401);
  });

  it("creates a competition with defaults and lists it", async () => {
    const created = await harness.api<Competition>(
      "POST",
      "/admin/competitions",
      {
        ...authed,
        body: { api_football_league_id: 39, name: "Premier League" },
      },
    );
    expect(created.status).toBe(200);
    expect(created.json?.kind).toBe("league");
    expect(created.json?.is_active).toBe(true);

    const list = await harness.api<Competition[]>(
      "GET",
      "/admin/competitions",
      authed,
    );
    expect(list.status).toBe(200);
    const pl = list.json?.find((c) => c.api_football_league_id === 39);
    expect(pl?.name).toBe("Premier League");
  });

  it("upserts by league and can deactivate", async () => {
    const created = await harness.api<Competition>(
      "POST",
      "/admin/competitions",
      {
        ...authed,
        body: { api_football_league_id: 40, name: "EFL Championship" },
      },
    );
    expect(created.status).toBe(200);

    const deactivated = await harness.api<Competition>(
      "POST",
      "/admin/competitions",
      {
        ...authed,
        body: {
          api_football_league_id: 40,
          name: "EFL Championship",
          is_active: false,
        },
      },
    );
    expect(deactivated.status).toBe(200);
    expect(deactivated.json?.id).toBe(created.json?.id as number);
    expect(deactivated.json?.is_active).toBe(false);

    const row = harness.sqlOne<{ n: number }>(
      "SELECT COUNT(*) as n FROM competitions WHERE api_football_league_id = 40",
    );
    expect(row?.n).toBe(1);
  });

  it("validates the request body", async () => {
    const res = await harness.api("POST", "/admin/competitions", {
      ...authed,
      body: { name: "No league id" },
    });
    expect(res.status).toBe(400);
  });
});
