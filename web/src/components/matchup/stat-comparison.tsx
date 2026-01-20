import { useQuery } from "@tanstack/solid-query";
import { createMemo, Show, Suspense } from "solid-js";
import { matchupStatsQueryOptions } from "~/api/analysis";
import { ComparisonBar } from "./comparison-bar";

interface StatComparisonProps {
  fixtureId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  activeTab: "season" | "form";
}

function StatComparisonSkeleton() {
  return (
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
}

function Inner(props: StatComparisonProps) {
  const statsQuery = useQuery(() => matchupStatsQueryOptions(props.fixtureId));

  const homeStats = createMemo(() =>
    props.activeTab === "season"
      ? statsQuery.data?.season.home
      : (statsQuery.data?.form?.home ?? statsQuery.data?.season.home),
  );

  const awayStats = createMemo(() =>
    props.activeTab === "season"
      ? statsQuery.data?.season.away
      : (statsQuery.data?.form?.away ?? statsQuery.data?.season.away),
  );

  if (statsQuery.error) {
    return (
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <div class="text-error text-sm">Failed to load stat comparison</div>
        </div>
      </div>
    );
  }

  return (
    <Show when={homeStats() && awayStats()}>
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <h3 class="text-lg font-semibold mb-4">Stat Comparison</h3>
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
    </Show>
  );
}

export function StatComparison(props: StatComparisonProps) {
  return (
    <Suspense fallback={<StatComparisonSkeleton />}>
      <Inner {...props} />
    </Suspense>
  );
}
