import OpenAI from "openai";
import type { TeamMetrics } from "~/api/analysis";
import type { Fixture, OddsLine, OddsStat } from "~/api/fixtures";

const CORNER_MARKET_IDS = new Set([45, 55, 56, 57, 58, 77, 85]);
const PROMPT_ID = "pmpt_697d87f74c4081909ca5842850e6664e07d90de1172ae337";
const PROMPT_VERSION = "4";

type MetricsBlock = {
  num_games: number;
  for_per_game: number;
  against_per_game: number;
};

type LlmPayload = {
  fixture: {
    home: string;
    away: string;
    id: number;
  };
  markets: OddsStat[];
  metrics: {
    form: {
      home: MetricsBlock;
      away: MetricsBlock;
    };
    season: {
      home: MetricsBlock;
      away: MetricsBlock;
    };
    venue: {
      home: MetricsBlock;
      away: MetricsBlock;
    };
  };
};

type LlmPick = {
  market_id: number | null;
  line_name: string | null;
  confidence: number;
  rationale: string;
};

export type CornerPick = {
  market_id: number;
  market_name: string;
  line: OddsLine;
  confidence: number;
  rationale: string;
};

export type CornerPickPayload = {
  fixture: Fixture;
  odds: OddsStat[] | undefined;
  metrics: {
    form: {
      home: TeamMetrics | undefined;
      away: TeamMetrics | undefined;
    };
    season: {
      home: TeamMetrics | undefined;
      away: TeamMetrics | undefined;
    };
    venue: {
      home: TeamMetrics | undefined;
      away: TeamMetrics | undefined;
    };
  };
  openAiKey: string;
};

type CornerPickResponse = {
  pick: CornerPick | null;
};

const CACHE_DURATION = 1000 * 60 * 180;
const GC_DURATION = CACHE_DURATION;
const cacheKeyFor = (fixtureId: number) => `corner-pick:${fixtureId}`;

const readCachedPick = (fixtureId: number) => {
  const key = cacheKeyFor(fixtureId);
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      storedAt: number;
      data: CornerPickResponse;
    };
    if (Date.now() - parsed.storedAt > CACHE_DURATION) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCachedPick = (fixtureId: number, data: CornerPickResponse) => {
  const key = cacheKeyFor(fixtureId);
  const value = JSON.stringify({ storedAt: Date.now(), data });
  localStorage.setItem(key, value);
};

const toMetricsBlock = (metrics: TeamMetrics): MetricsBlock => ({
  num_games: metrics.num_fixtures,
  for_per_game: metrics.for.perGame.corners,
  against_per_game: metrics.against.perGame.corners,
});

const isValidPick = (value: unknown): value is LlmPick => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const marketId = record.market_id;
  const lineName = record.line_name;
  const confidence = record.confidence;
  const rationale = record.rationale;

  const marketValid =
    marketId === null ||
    (typeof marketId === "number" && Number.isFinite(marketId));
  const lineValid = lineName === null || typeof lineName === "string";
  const confidenceValid =
    typeof confidence === "number" && confidence >= 0 && confidence <= 1;
  const rationaleValid = typeof rationale === "string";

  return marketValid && lineValid && confidenceValid && rationaleValid;
};

const buildPayload = (input: CornerPickPayload): LlmPayload | null => {
  const { fixture, odds, metrics } = input;
  if (!odds) return null;
  if (
    !metrics.form.home ||
    !metrics.form.away ||
    !metrics.season.home ||
    !metrics.season.away ||
    !metrics.venue.home ||
    !metrics.venue.away
  ) {
    return null;
  }

  const cornerMarkets = odds.filter(market => CORNER_MARKET_IDS.has(market.id));
  if (cornerMarkets.length === 0) return null;

  return {
    fixture: {
      home: fixture.home.name,
      away: fixture.away.name,
      id: fixture.id,
    },
    markets: cornerMarkets,
    metrics: {
      form: {
        home: toMetricsBlock(metrics.form.home),
        away: toMetricsBlock(metrics.form.away),
      },
      season: {
        home: toMetricsBlock(metrics.season.home),
        away: toMetricsBlock(metrics.season.away),
      },
      venue: {
        home: toMetricsBlock(metrics.venue.home),
        away: toMetricsBlock(metrics.venue.away),
      },
    },
  };
};

const fetchCornerPick = async (
  apiKey: string,
  payload: LlmPayload,
): Promise<CornerPickResponse> => {
  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.responses.create({
    prompt: {
      id: PROMPT_ID,
      version: PROMPT_VERSION,
    },
    input: `JSON payload:\n${JSON.stringify(payload)}`,
    reasoning: { effort: "high" },
  });

  const content = response.output_text?.trim();

  if (!content) return { pick: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { pick: null };
  }

  if (!isValidPick(parsed)) return { pick: null };
  if (parsed.market_id == null || parsed.line_name == null)
    return { pick: null };

  const market = payload.markets.find(m => m.id === parsed.market_id);
  if (!market) return { pick: null };
  const line = market.values.find(v => v.name === parsed.line_name);
  if (!line) return { pick: null };

  return {
    pick: {
      market_id: market.id,
      market_name: market.name,
      line,
      confidence: parsed.confidence,
      rationale: parsed.rationale.slice(0, 200),
    },
  };
};

export const cornerPickQueryOptions = (input: CornerPickPayload) => {
  const payload = buildPayload(input);
  const enabled = Boolean(input.openAiKey) && payload !== null;
  return {
    queryKey: ["matchup", input.fixture.id, "corner-pick"],
    enabled,
    staleTime: CACHE_DURATION,
    gcTime: GC_DURATION,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    queryFn: async (): Promise<CornerPickResponse> => {
      if (!payload) return { pick: null };
      const cached = readCachedPick(input.fixture.id);
      if (cached) return cached;

      const result = await fetchCornerPick(input.openAiKey, payload);
      writeCachedPick(input.fixture.id, result);
      return result;
    },
  };
};
