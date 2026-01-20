import { createMemo, Show, Suspense } from "solid-js";
import { type TeamStats, useMatchupStats } from "~/api/analysis";
import { useMatchupForm } from "~/api/fixtures";
import { FormTimeline } from "~/components/form-timeline";

interface RecentFormProps {
  fixtureId: number;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  activeTab: "season" | "form";
}

function RecentFormSkeleton() {
  return (
    <div class="card bg-base-100 border border-base-300">
      <div class="card-body">
        <div class="animate-pulse bg-base-300 h-6 w-32 rounded mb-4" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <div class="flex justify-between">
              <div class="animate-pulse bg-base-300 h-4 w-24 rounded" />
              <div class="animate-pulse bg-base-300 h-4 w-16 rounded" />
            </div>
            <div class="flex gap-2">
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
            </div>
            <div class="animate-pulse bg-base-300 h-3 w-20 rounded" />
          </div>
          <div class="space-y-2">
            <div class="flex justify-between">
              <div class="animate-pulse bg-base-300 h-4 w-24 rounded" />
              <div class="animate-pulse bg-base-300 h-4 w-16 rounded" />
            </div>
            <div class="flex gap-2">
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
              <div class="animate-pulse bg-base-300 h-6 w-8 rounded" />
            </div>
            <div class="animate-pulse bg-base-300 h-3 w-20 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

const getFormRating = (stats: TeamStats) => {
  const gamesPlayed = stats.wins + stats.losses + stats.draws;
  if (gamesPlayed === 0) return "unknown";
  const winRate = stats.wins / gamesPlayed;

  if (winRate >= 0.65) return "excellent";
  if (winRate >= 0.5) return "good";
  if (winRate >= 0.35) return "average";
  return "poor";
};

const getFormBadgeClass = (rating: string) => {
  switch (rating.toLowerCase()) {
    case "excellent":
      return "badge-success";
    case "good":
      return "badge-info";
    case "average":
      return "badge-warning";
    case "poor":
      return "badge-error";
    default:
      return "badge-ghost";
  }
};

function Inner(props: RecentFormProps) {
  const statsQuery = useMatchupStats(props.fixtureId);
  const formQuery = useMatchupForm(props.fixtureId);

  const homeFormFixtures = createMemo(() => formQuery.data?.home ?? []);
  const awayFormFixtures = createMemo(() => formQuery.data?.away ?? []);

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

  return (
    <Show when={homeStats() && awayStats()}>
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <h3 class="text-lg font-semibold mb-4">Recent Form</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Home Form */}
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium">{props.homeTeam.name}</span>
                <span
                  class={`badge ${getFormBadgeClass(getFormRating(homeStats()!))}`}
                >
                  {getFormRating(homeStats()!)}
                </span>
              </div>
              <FormTimeline
                fixtures={homeFormFixtures()}
                teamId={props.homeTeam.id}
              />
              <div class="text-sm text-base-content/60 mt-2">
                {homeStats()!.wins}W - {homeStats()!.draws}D -{" "}
                {homeStats()!.losses}L
              </div>
            </div>

            {/* Away Form */}
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium">{props.awayTeam.name}</span>
                <span
                  class={`badge ${getFormBadgeClass(getFormRating(awayStats()!))}`}
                >
                  {getFormRating(awayStats()!)}
                </span>
              </div>
              <FormTimeline
                fixtures={awayFormFixtures()}
                teamId={props.awayTeam.id}
              />
              <div class="text-sm text-base-content/60 mt-2">
                {awayStats()!.wins}W - {awayStats()!.draws}D -{" "}
                {awayStats()!.losses}L
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}

export function RecentForm(props: RecentFormProps) {
  return (
    <Suspense fallback={<RecentFormSkeleton />}>
      <Inner {...props} />
    </Suspense>
  );
}
