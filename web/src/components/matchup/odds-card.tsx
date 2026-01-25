import { useQuery } from "@tanstack/solid-query";
import { createSignal, For, Match, Show, Switch, useContext } from "solid-js";
import { fixtureOddsQueryOptions, type OddsStat } from "~/api/fixtures";
import { formatOdds } from "~/lib/formatters";
import { BetFormContext } from "../bet-form.context";

// Corner market IDs
const CORNER_MARKET_IDS = new Set([45, 55, 56, 57, 58, 77, 85]);

interface OddsCardProps {
  fixtureId: number;
  homeName: string;
  awayName: string;
}

function parseLineFromName(name: string): number | undefined {
  // Extract numeric line from strings like "Over 9.5", "Under 10", "Home -2"
  const match = name.match(/-?\d+\.?\d*/);
  return match ? parseFloat(match[0]) : undefined;
}

function OddsMarket(props: {
  market: OddsStat;
  fixtureId: number;
  homeName: string;
  awayName: string;
}) {
  const [_, { show }] = useContext(BetFormContext);

  const handleLineClick = (lineName: string, odd: number) => {
    const line = parseLineFromName(lineName);

    // Build description: "Home Corners Over 5.5" or "Total Corners Over 9.5"
    const description = `${props.market.name} ${lineName}`;

    show(props.fixtureId, {
      type_id: props.market.id,
      description,
      odds: odd,
      line,
    });
  };

  return (
    <div class="space-y-2">
      <div class="text-sm font-medium text-base-content/70">
        {props.market.name}
      </div>
      <div class="flex flex-wrap gap-2">
        <For each={props.market.values}>
          {line => (
            <button
              type="button"
              class="btn btn-sm btn-outline"
              onClick={() => handleLineClick(line.name, line.odd)}
            >
              <span class="text-xs">{line.name}</span>
              <span class="font-mono font-semibold">{formatOdds(line.odd)}</span>
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
                <span class="text-base-content/50 text-sm">No odds available</span>
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
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
