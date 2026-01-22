import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, Match, Show, Suspense, Switch } from "solid-js";
import { matchupStatsQueryOptions } from "~/api/analysis";
import { ComparisonBar } from "./comparison-bar";

interface StatComparisonProps {
  fixtureId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  activeTab: "season" | "form";
}

type VenueView = "contextual" | "full";

const StatComparisonLoading = () => (
  <div class="card bg-base-100 border border-base-300">
    <div class="card-body">
      <div class="animate-pulse bg-base-300 h-6 w-36 rounded mb-4" />
      <div class="space-y-4">
        <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
        <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
        <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
        <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
        <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
        <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
      </div>
    </div>
  </div>
);

function Inner(props: StatComparisonProps) {
  const statsQuery = useQuery(() => matchupStatsQueryOptions(props.fixtureId));
  const [venueView, setVenueView] = createSignal<VenueView>("contextual");

  const homeStats = createMemo(() => {
    if (props.activeTab === "form") {
      return statsQuery.data?.form?.home ?? statsQuery.data?.season.home.overall;
    }
    const seasonStats = statsQuery.data?.season.home;
    if (!seasonStats) return undefined;
    return venueView() === "contextual" ? seasonStats.home_only : seasonStats.overall;
  });

  const awayStats = createMemo(() => {
    if (props.activeTab === "form") {
      return statsQuery.data?.form?.away ?? statsQuery.data?.season.away.overall;
    }
    const seasonStats = statsQuery.data?.season.away;
    if (!seasonStats) return undefined;
    return venueView() === "contextual" ? seasonStats.away_only : seasonStats.overall;
  });

  const hasData = () => homeStats() && awayStats();

  return (
    <Switch>
      <Match when={statsQuery.isError}>
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <div class="text-error text-sm">Failed to load stat comparison</div>
          </div>
        </div>
      </Match>

      <Match when={hasData()}>
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">Stat Comparison</h3>
              <Show when={props.activeTab === "season"}>
                <div class="join">
                  <button
                    type="button"
                    class="btn btn-xs join-item"
                    classList={{ "btn-active": venueView() === "contextual" }}
                    onClick={() => setVenueView("contextual")}
                  >
                    Contextual
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs join-item"
                    classList={{ "btn-active": venueView() === "full" }}
                    onClick={() => setVenueView("full")}
                  >
                    Full
                  </button>
                </div>
              </Show>
            </div>
            <div class="space-y-4">
              <ComparisonBar
                label="Expected Goals For (xGF)"
                homeValue={homeStats()!.xgf}
                awayValue={awayStats()!.xgf}
                homeName={props.homeTeam.name}
                awayName={props.awayTeam.name}
              />
              <ComparisonBar
                label="Expected Goals Against (xGA)"
                homeValue={homeStats()!.xga}
                awayValue={awayStats()!.xga}
                homeName={props.homeTeam.name}
                awayName={props.awayTeam.name}
                inverse
              />
              <ComparisonBar
                label="Goals Scored"
                homeValue={homeStats()!.goals_for}
                awayValue={awayStats()!.goals_for}
                homeName={props.homeTeam.name}
                awayName={props.awayTeam.name}
                formatValue={v => v.toString()}
              />
              <ComparisonBar
                label="Goals Conceded"
                homeValue={homeStats()!.goals_against}
                awayValue={awayStats()!.goals_against}
                homeName={props.homeTeam.name}
                awayName={props.awayTeam.name}
                inverse
                formatValue={v => v.toString()}
              />
              <ComparisonBar
                label="Clean Sheets"
                homeValue={homeStats()!.cleansheets}
                awayValue={awayStats()!.cleansheets}
                homeName={props.homeTeam.name}
                awayName={props.awayTeam.name}
                formatValue={v => v.toString()}
              />
              <ComparisonBar
                label="Win Rate"
                homeValue={homeStats()!.win_rate}
                awayValue={awayStats()!.win_rate}
                homeName={props.homeTeam.name}
                awayName={props.awayTeam.name}
                formatValue={v => `${(v * 100).toFixed(0)}%`}
              />
            </div>
          </div>
        </div>
      </Match>
    </Switch>
  );
}

export function StatComparison(props: StatComparisonProps) {
  return (
    <Suspense fallback={<StatComparisonLoading />}>
      <Inner {...props} />
    </Suspense>
  );
}

StatComparison.Loading = StatComparisonLoading;
