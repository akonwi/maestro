import { useQuery } from "@tanstack/solid-query";
import {
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  useContext,
} from "solid-js";
import {
  fixtureOddsQueryOptions,
  type LineType,
  type OddsStat,
} from "~/api/fixtures";
import { formatOdds } from "~/lib/formatters";
import { BetFormContext } from "../bet-form.context";

// Corner market IDs
const CORNER_MARKET_IDS = new Set([45, 55, 56, 57, 58, 77, 85]);

export interface CornerProjections {
  homeFor: number;
  awayFor: number;
  total: number;
}

export interface CornerConfidenceInputs {
  homeFormFor: number;
  awayFormFor: number;
  homeSeasonFor: number;
  awaySeasonFor: number;
  totalFormFor: number;
  totalSeasonFor: number;
}

interface OddsCardProps {
  fixtureId: number;
  homeName: string;
  awayName: string;
  cornerProjections?: CornerProjections;
  cornerConfidence?: CornerConfidenceInputs;
}

interface ConfidenceData {
  tier: number;
  score: number;
  edge: number;
  formDelta: number;
  projection: number;
  basis: "home" | "away" | "total";
}

function calculateEdge(
  type: LineType,
  value: number,
  projected: number,
): number {
  switch (type) {
    case "exactly":
      // Closer to projection is better
      return -Math.abs(value - projected);
    case "home":
      // Handicap: projected = homeFor - awayFor (positive = home advantage)
      // Home -6 means home needs to win by 6+
      return projected - Math.abs(value);
    case "away":
      // Away -6 means away needs to win by 6+
      return -projected - Math.abs(value);
    case "over":
      return projected - value;
    case "under":
      return value - projected;
  }
}

function getProjectionForMarket(
  marketName: string,
  projections: CornerProjections | undefined,
): number | undefined {
  if (!projections) return undefined;

  const name = marketName.toLowerCase();

  // Check specific patterns first
  if (name.includes("asian") || name.includes("handicap")) {
    return projections.homeFor - projections.awayFor;
  }
  if (name.includes("home")) return projections.homeFor;
  if (name.includes("away")) return projections.awayFor;
  // "Total Corners", "Total Corners (3-Way)", "Most Corners" all use total
  if (name.includes("total") || name.includes("most")) return projections.total;

  return undefined;
}

interface OddsLineWithEdge {
  name: string;
  odd: number;
  type: LineType;
  value: number | null;
  edge: number | undefined;
  confidence?: ConfidenceData;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getConfidenceBasis(marketName: string): ConfidenceData["basis"] {
  const name = marketName.toLowerCase();
  if (name.includes("home")) return "home";
  if (name.includes("away")) return "away";
  return "total";
}

function getConfidenceInputs(
  basis: ConfidenceData["basis"],
  confidence: CornerConfidenceInputs | undefined,
) {
  if (!confidence) return undefined;
  switch (basis) {
    case "home":
      return {
        formFor: confidence.homeFormFor,
        seasonFor: confidence.homeSeasonFor,
      };
    case "away":
      return {
        formFor: confidence.awayFormFor,
        seasonFor: confidence.awaySeasonFor,
      };
    default:
      return {
        formFor: confidence.totalFormFor,
        seasonFor: confidence.totalSeasonFor,
      };
  }
}

function mapConfidenceTier(score: number) {
  if (score >= 0.35) return 5;
  if (score >= 0.2) return 4;
  if (score >= 0.05) return 3;
  if (score >= -0.1) return 2;
  return 1;
}

function calculateConfidence(
  edge: number | undefined,
  projection: number | undefined,
  formFor: number | undefined,
  seasonFor: number | undefined,
  basis: ConfidenceData["basis"],
): ConfidenceData | undefined {
  if (
    edge == null ||
    projection == null ||
    formFor == null ||
    seasonFor == null
  )
    return undefined;

  const edgeScore = clamp(edge / 2, -1, 1);
  const formDelta = formFor - seasonFor;
  const formDeltaScore = clamp(formDelta / Math.max(1, seasonFor), -0.5, 0.5);
  const strengthScore = clamp(Math.abs(projection) / 10, 0, 1);
  const score = 0.5 * edgeScore + 0.3 * formDeltaScore + 0.2 * strengthScore;

  return {
    tier: mapConfidenceTier(score),
    score,
    edge,
    formDelta,
    projection,
    basis,
  };
}

function OddsMarket(props: {
  market: OddsStat;
  fixtureId: number;
  homeName: string;
  awayName: string;
  projection: number | undefined;
  is3Way: boolean;
  confidence?: CornerConfidenceInputs;
}) {
  const [_, { show }] = useContext(BetFormContext);

  const handleLineClick = (
    lineName: string,
    odd: number,
    value: number | null,
    confidence: ConfidenceData | undefined,
  ) => {
    // Build description: "Home Corners Over 5.5" or "Total Corners Over 9.5"
    const description = `${props.market.name} ${lineName}`;

    show(props.fixtureId, {
      type_id: props.market.id,
      description,
      odds: odd,
      line: value !== null ? Math.abs(value) : undefined,
      confidence,
    });
  };

  const sortedLines = createMemo((): OddsLineWithEdge[] => {
    const linesWithEdge = props.market.values.map(line => {
      const edge =
        line.value !== null && props.projection !== undefined
          ? calculateEdge(line.type, line.value, props.projection)
          : undefined;
      const basis = getConfidenceBasis(props.market.name);
      const confidenceInputs = getConfidenceInputs(basis, props.confidence);
      const confidence = calculateConfidence(
        edge,
        props.projection,
        confidenceInputs?.formFor,
        confidenceInputs?.seasonFor,
        basis,
      );
      return { ...line, edge, confidence };
    });

    // Filter out:
    // 1. Lines with odds too low to provide meaningful returns (American odds)
    //    - Positive odds: always keep (good returns)
    //    - Negative odds: keep if > -150 (e.g., -109 is better than -150)
    // 2. For 3-way markets: filter out lines too far from projection AND with bad edge
    // 3. For handicap markets: filter out lines with very negative edge
    const MIN_NEGATIVE_ODDS = -150;
    const MAX_DISTANCE_3WAY = 2; // Only show lines within 2 of projection
    const MIN_EDGE_3WAY = -1.5; // Filter out lines with very negative edge
    const MIN_EDGE_HANDICAP = -4; // Filter out handicap lines with edge worse than -4
    const filtered = linesWithEdge.filter(line => {
      // Filter by odds (American format)
      // Positive odds are always good, negative odds must be better than threshold
      if (line.odd < 0 && line.odd < MIN_NEGATIVE_ODDS) return false;

      // For 3-way markets: filter by both distance AND edge
      if (props.is3Way && props.projection !== undefined) {
        if (line.value !== null) {
          // Distance filter: line must be within 2 of projection
          const distance = Math.abs(line.value - props.projection);
          if (distance > MAX_DISTANCE_3WAY) return false;
        }
        // Edge filter: don't show lines with very negative edge
        if (line.edge !== undefined && line.edge < MIN_EDGE_3WAY) return false;
      }

      // For handicap markets (home/away): filter out lines with very negative edge
      if (
        (line.type === "home" || line.type === "away") &&
        line.edge !== undefined &&
        line.edge < MIN_EDGE_HANDICAP
      ) {
        return false;
      }

      return true;
    });

    // Sort by edge descending (highest positive edge first)
    if (props.projection !== undefined) {
      filtered.sort((a, b) => {
        if (a.edge === undefined) return 1;
        if (b.edge === undefined) return -1;
        return b.edge - a.edge;
      });
    }

    return filtered;
  });

  return (
    <div class="space-y-2">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-base-content/70">
          {props.market.name}
        </span>
        <Show when={props.projection !== undefined}>
          <span class="text-xs text-base-content/50">
            (proj: {props.projection?.toFixed(1)})
          </span>
        </Show>
      </div>
      <div class="flex flex-wrap gap-2">
        <For each={sortedLines()}>
          {line => (
            <button
              type="button"
              class="btn btn-sm btn-outline"
              onClick={() =>
                handleLineClick(
                  line.name,
                  line.odd,
                  line.value,
                  line.confidence,
                )
              }
            >
              <span class="text-xs">{line.name}</span>
              <span class="font-mono font-semibold">
                {formatOdds(line.odd)}
              </span>
              <Show when={line.edge !== undefined}>
                <span
                  class={`badge badge-xs ${line.edge! > 0 ? "badge-success" : "badge-ghost"}`}
                >
                  {line.edge! > 0 ? "+" : ""}
                  {line.edge!.toFixed(1)}
                </span>
              </Show>
              <Show when={line.confidence}>
                <span
                  class={`badge badge-xs ${
                    line.confidence!.tier >= 4
                      ? "badge-success"
                      : line.confidence!.tier >= 3
                        ? "badge-warning"
                        : "badge-ghost"
                  }`}
                >
                  C{line.confidence!.tier}
                </span>
              </Show>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

export function OddsCard(props: OddsCardProps) {
  const [isExpanded, setIsExpanded] = createSignal(false);

  const oddsQuery = useQuery(() => fixtureOddsQueryOptions(props.fixtureId));

  const cornerMarkets = () =>
    (oddsQuery.data ?? []).filter(stat => CORNER_MARKET_IDS.has(stat.id));

  const hasCornerOdds = () => cornerMarkets().length > 0;

  return (
    <div class="card bg-base-100 border border-base-300">
      <button
        type="button"
        class="card-body p-4 cursor-pointer"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Odds</h3>
          <div class="flex items-center gap-2">
            <Switch>
              <Match when={oddsQuery.isPending}>
                <span class="loading loading-spinner loading-xs" />
              </Match>
              <Match when={oddsQuery.isError}>
                <span class="text-error text-sm">Failed to load</span>
              </Match>
              <Match when={!hasCornerOdds()}>
                <span class="text-base-content/50 text-sm">
                  No odds available
                </span>
              </Match>
              <Match when={hasCornerOdds()}>
                <span class="text-base-content/50 text-sm">
                  {cornerMarkets().length} markets
                </span>
              </Match>
            </Switch>
            <svg
              class="w-5 h-5 transition-transform"
              classList={{ "rotate-180": isExpanded() }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Chevron</title>
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      <Show when={isExpanded() && hasCornerOdds()}>
        <div class="px-4 pb-4 space-y-4">
          <For each={cornerMarkets()}>
            {market => (
              <OddsMarket
                market={market}
                fixtureId={props.fixtureId}
                homeName={props.homeName}
                awayName={props.awayName}
                projection={getProjectionForMarket(
                  market.name,
                  props.cornerProjections,
                )}
                is3Way={market.name.toLowerCase().includes("3-way")}
                confidence={props.cornerConfidence}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
