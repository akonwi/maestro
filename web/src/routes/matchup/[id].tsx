/** biome-ignore-all lint/style/noNonNullAssertion: Switch and Match ensure where something can be asserted */
import { A, useParams } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import { matchupStatsQueryOptions } from "~/api/analysis";
import { fixtureQueryOptions } from "~/api/fixtures";
import { MetricsMatchup } from "~/components/matchup/metrics-matchup";
import { RecentForm } from "~/components/matchup/recent-form";
import { StatComparison } from "~/components/matchup/stat-comparison";
import { StatsTable } from "~/components/matchup/stats-table";

function logoUrl(id: number) {
  return `https://media.api-sports.io/football/teams/${id}.png`;
}

export function MatchupSkeleton() {
  return (
    <div class="space-y-6">
      <div class="animate-pulse bg-base-300 h-8 w-48 rounded" />
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="animate-pulse bg-base-300 h-16 w-16 rounded-full" />
              <div class="animate-pulse bg-base-300 h-6 w-32 rounded" />
            </div>
            <div class="animate-pulse bg-base-300 h-8 w-16 rounded" />
            <div class="flex items-center gap-4">
              <div class="animate-pulse bg-base-300 h-6 w-32 rounded" />
              <div class="animate-pulse bg-base-300 h-16 w-16 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <div class="animate-pulse bg-base-300 h-6 w-40 rounded mb-4" />
          <div class="space-y-4">
            <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
            <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
            <div class="animate-pulse bg-base-300 h-8 w-full rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MatchupPage() {
  const params = useParams();
  const matchId = () => Number(params.id);

  const fixtureQuery = useQuery(() => fixtureQueryOptions(matchId()));
  const fixture = () => fixtureQuery.data;
  const statsQuery = useQuery(() => matchupStatsQueryOptions(matchId()));

  // Only show form tab if stats loaded successfully and form data exists
  const hasFormData = () =>
    statsQuery.isSuccess && statsQuery.data?.form !== null;

  const [activeTab, setActiveTab] = createSignal<"season" | "form">("form");

  const homeStats = createMemo(() =>
    activeTab() === "season"
      ? statsQuery.data?.season.home
      : (statsQuery.data?.form?.home ?? statsQuery.data?.season.home),
  );

  const awayStats = createMemo(() =>
    activeTab() === "season"
      ? statsQuery.data?.season.away
      : (statsQuery.data?.form?.away ?? statsQuery.data?.season.away),
  );

  const formattedDateTime = createMemo(() => {
    const timestamp = fixtureQuery.data?.timestamp;
    if (!timestamp) return { date: "", time: "" };
    const matchDate = new Date(timestamp);
    return {
      date: matchDate.toLocaleDateString(),
      time: matchDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  return (
    <div class="space-y-6 max-w-4xl mx-auto">
      <Switch>
        <Match when={fixtureQuery.isError}>
          <div class="alert alert-error">
            <span>Failed to load matchup: {fixtureQuery.error?.message}</span>
          </div>
        </Match>

        <Match when={fixtureQuery.isSuccess}>
          {/* Header */}
          <div class="text-sm text-base-content/60">
            {fixture()?.league.name} • {formattedDateTime().date} •{" "}
            {formattedDateTime().time}
          </div>

          {/* Teams Header Card */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body p-4 md:p-8">
              <div class="flex flex-row items-center justify-between gap-2 md:gap-6">
                {/* Home Team */}
                <A
                  href={`/teams/${fixture()!.home.id}?league=${fixture()!.league.id}&season=${fixture()!.season}`}
                  class="flex flex-col items-center gap-1 md:gap-2 flex-1 hover:opacity-80 transition-opacity min-w-0"
                >
                  <img
                    src={logoUrl(fixture()!.home.id)}
                    alt={fixture()!.home.name}
                    class="w-10 h-10 md:w-16 md:h-16"
                  />
                  <div class="text-sm md:text-xl font-bold text-center link-hover truncate w-full">
                    {fixture()!.home.name}
                  </div>
                  <div class="text-xs md:text-sm text-base-content/60">
                    Home
                  </div>
                </A>

                {/* Score / VS */}
                <div class="text-center shrink-0">
                  <Show
                    when={fixture()!.finished}
                    fallback={
                      <div class="text-lg md:text-2xl font-bold">VS</div>
                    }
                  >
                    <div class="text-xl md:text-3xl font-bold">
                      {fixture()!.home_goals} - {fixture()!.away_goals}
                    </div>
                    <div class="badge badge-neutral badge-sm md:badge-md mt-1 md:mt-2">
                      Full Time
                    </div>
                  </Show>
                </div>

                {/* Away Team */}
                <A
                  href={`/teams/${fixture()!.away.id}?league=${fixture()!.league.id}&season=${fixture()!.season}`}
                  class="flex flex-col items-center gap-1 md:gap-2 flex-1 hover:opacity-80 transition-opacity min-w-0"
                >
                  <img
                    src={logoUrl(fixture()!.away.id)}
                    alt={fixture()!.away.name}
                    class="w-10 h-10 md:w-16 md:h-16"
                  />
                  <div class="text-sm md:text-xl font-bold text-center link-hover truncate w-full">
                    {fixture()!.away.name}
                  </div>
                  <div class="text-xs md:text-sm text-base-content/60">
                    Away
                  </div>
                </A>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Show when={hasFormData()}>
            <div class="tabs tabs-boxed w-fit">
              <button
                type="button"
                classList={{
                  "tab-active": activeTab() === "season",
                }}
                class="tab"
                onClick={() => setActiveTab("season")}
              >
                Season
              </button>
              <button
                type="button"
                classList={{
                  "tab-active": activeTab() === "form",
                }}
                class="tab"
                onClick={() => setActiveTab("form")}
              >
                Last 5
              </button>
            </div>
          </Show>

          {/* Recent Form */}
          <RecentForm
            fixtureId={matchId()}
            homeTeam={fixture()!.home}
            awayTeam={fixture()!.away}
            activeTab={activeTab()}
          />

          {/* Stat Comparison */}
          <StatComparison
            fixtureId={matchId()}
            homeTeam={fixture()!.home}
            awayTeam={fixture()!.away}
            activeTab={activeTab()}
          />

          {/* Attack vs Defense Metrics */}
          <MetricsMatchup
            homeId={fixture()!.home.id}
            awayId={fixture()!.away.id}
            homeName={fixture()!.home.name}
            awayName={fixture()!.away.name}
            leagueId={fixture()!.league.id}
            season={fixture()!.season}
            limit={activeTab() === "form" ? 5 : undefined}
          />

          {/* Detailed Stats Table */}
          <Show when={homeStats() && awayStats()}>
            <div class="card bg-base-100 border border-base-300">
              <div class="card-body">
                <h3 class="text-lg font-semibold mb-4">Detailed Stats</h3>
                <StatsTable
                  home={homeStats()!}
                  away={awayStats()!}
                  homeName={fixture()!.home.name}
                  awayName={fixture()!.away.name}
                />
              </div>
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  );
}
