import { useParams, useSearchParams } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import { teamStatsQueryOptions } from "~/api/analysis";
import { Team } from "~/api/fixtures";
import { performanceQueryOptions } from "~/api/teams";
import { FormTimeline } from "~/components/form-timeline";
import { GameMetrics } from "~/components/game-metrics";

function logoUrl(model: "teams" | "leagues", id: number) {
  return `https://media.api-sports.io/football/${model}/${id}.png`;
}

export default function TeamStatsPage() {
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const teamId = Number(routeParams.id);
  const league = Number(searchParams.league);
  const season = Number(searchParams.season);

  const teamQuery = useQuery<Team>(() => ({
    queryKey: ["teams", teamId],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/teams/${teamId}`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch team: ${await response.text()}`);
      }

      return response.json();
    },
  }));
  const performanceQuery = useQuery(() =>
    performanceQueryOptions({ id: teamId, league, season }),
  );
  const statsQuery = useQuery(() =>
    teamStatsQueryOptions({ teamId, leagueId: league, season }),
  );

  const perf = () => performanceQuery.data;
  const team = () => teamQuery.data;

  const [activeTab, setActiveTab] = createSignal<"season" | "form">("form");

  const formFixtures = createMemo(() => {
    const all = perf()?.fixtures.all ?? [];
    const completed = all.filter((f) => f.finished);
    const sorted = [...completed].sort((a, b) => a.timestamp - b.timestamp);
    if (activeTab() === "form") {
      return sorted.slice(-5);
    }
    return sorted;
  });

  // Show tabs if we have form data from the stats endpoint
  const hasFormData = () =>
    statsQuery.isSuccess && statsQuery.data?.form !== null;
  const showTabs = () => hasFormData();

  // Rich stats from the new stats endpoint (Snapshot data)
  const snapshotStats = createMemo(() => {
    if (activeTab() === "form") {
      return statsQuery.data?.form ?? statsQuery.data?.season.overall;
    }
    return statsQuery.data?.season.overall;
  });

  // Basic stats from performance endpoint (for home/away split table)
  const perfStats = createMemo(() => {
    const p = perf();
    if (!p) return null;
    return {
      played: p.fixtures.played,
      wins: p.fixtures.wins,
      draws: p.fixtures.draws,
      losses: p.fixtures.losses,
      goalsFor: p.goals.for,
      goalsAgainst: p.goals.against,
      cleansheets: p.cleansheets,
      failedToScore: p.failed_to_score,
    };
  });

  const getWinRate = () => {
    const s = snapshotStats();
    if (!s?.num_games) return "0";
    return (s.win_rate * 100).toFixed(1);
  };

  if (!teamId || !league || !season) {
    return (
      <div class="text-center py-12">
        <div class="text-error text-lg">Missing required parameters</div>
        <div class="text-base-content/60 text-sm mt-2">
          Team ID, League, and Season are required
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <h1 class="text-3xl font-bold">Team Statistics</h1>

      <Switch>
        <Match when={performanceQuery.isError}>
          <div class="alert alert-error">
            <span>
              Failed to load team performance:{" "}
              {performanceQuery.error instanceof Error
                ? performanceQuery.error.message
                : "Unknown error"}
            </span>
          </div>
        </Match>

        <Match when={performanceQuery.isPending}>
          <div class="flex w-52 flex-col gap-4">
            <div class="skeleton h-32 w-full"></div>
            <div class="skeleton h-4 w-28"></div>
            <div class="skeleton h-4 w-full"></div>
            <div class="skeleton h-4 w-full"></div>
          </div>
        </Match>

        <Match when={perf()}>
          {/* Team Header */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <div class="flex items-center gap-4">
                <img
                  src={logoUrl("teams", teamId)}
                  alt={team()?.name}
                  class="w-16 h-16"
                />
                <div class="flex-1">
                  <h2 class="text-2xl font-bold">{team()?.name}</h2>
                  <div class="text-base-content/60">
                    {perf()?.league?.name} • {season}
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-3xl font-bold">{getWinRate()}%</div>
                  <div class="text-sm text-base-content/60">Win Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Period Tabs */}
          <Show when={showTabs()}>
            <div class="tabs tabs-boxed w-fit">
              <button
                type="button"
                classList={{ "tab-active": activeTab() === "season" }}
                class="tab"
                onClick={() => setActiveTab("season")}
              >
                Season
              </button>
              <button
                type="button"
                classList={{ "tab-active": activeTab() === "form" }}
                class="tab"
                onClick={() => setActiveTab("form")}
              >
                Last 5
              </button>
            </div>
          </Show>

          {/* Form */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <h3 class="text-lg font-semibold mb-4">Form</h3>
              <FormTimeline fixtures={formFixtures()} teamId={teamId} />
            </div>
          </div>

          {/* Game Metrics */}
          <GameMetrics
            teamId={teamId}
            leagueId={league}
            season={season}
            limit={activeTab() === "form" ? 5 : undefined}
          />

          {/* Match Statistics */}
          <Show when={snapshotStats()}>
            <div class="card bg-base-100 border border-base-300">
              <div class="card-body">
                <h3 class="text-lg font-semibold mb-4">Match Statistics</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div class="text-center">
                    <div class="text-2xl font-bold">
                      {snapshotStats()?.num_games}
                    </div>
                    <div class="text-sm text-base-content/60">Matches</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-success">
                      {snapshotStats()?.wins}
                    </div>
                    <div class="text-sm text-base-content/60">Wins</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-warning">
                      {snapshotStats()?.draws}
                    </div>
                    <div class="text-sm text-base-content/60">Draws</div>
                  </div>
                  <div class="text-center">
                    <div class="text-2xl font-bold text-error">
                      {snapshotStats()?.losses}
                    </div>
                    <div class="text-sm text-base-content/60">Losses</div>
                  </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div class="text-center">
                    <div class="text-xl font-bold">
                      {snapshotStats()?.goals_for}
                    </div>
                    <div class="text-sm text-base-content/60">Goals For</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xl font-bold">
                      {snapshotStats()?.goals_against}
                    </div>
                    <div class="text-sm text-base-content/60">
                      Goals Against
                    </div>
                  </div>
                  <div class="text-center">
                    <div class="text-xl font-bold">
                      {snapshotStats()?.cleansheets}
                    </div>
                    <div class="text-sm text-base-content/60">Clean Sheets</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xl font-bold">
                      {((snapshotStats()?.strike_rate ?? 0) * 100).toFixed(0)}%
                    </div>
                    <div class="text-sm text-base-content/60">Strike Rate</div>
                  </div>
                </div>

                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div class="text-center">
                    <div class="text-xl font-bold">
                      {snapshotStats()?.xgf.toFixed(2)}
                    </div>
                    <div class="text-sm text-base-content/60">xG For</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xl font-bold">
                      {snapshotStats()?.xga.toFixed(2)}
                    </div>
                    <div class="text-sm text-base-content/60">xG Against</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xl font-bold">
                      {snapshotStats()?.one_conceded}
                    </div>
                    <div class="text-sm text-base-content/60">1 Conceded</div>
                  </div>
                  <div class="text-center">
                    <div class="text-xl font-bold">
                      {snapshotStats()?.two_plus_conceded}
                    </div>
                    <div class="text-sm text-base-content/60">2+ Conceded</div>
                  </div>
                </div>
              </div>
            </div>
          </Show>

          {/* Home vs Away Split */}
          <Show when={perfStats()}>
            <div class="card bg-base-100 border border-base-300">
              <div class="card-body">
                <h3 class="text-lg font-semibold mb-4">
                  Home vs Away Performance
                </h3>
                <div class="overflow-x-auto">
                  <table class="table table-zebra w-full">
                    <thead>
                      <tr>
                        <th></th>
                        <th class="text-center">Home</th>
                        <th class="text-center">Away</th>
                        <th class="text-center">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Played</td>
                        <td class="text-center">{perfStats()?.played.home}</td>
                        <td class="text-center">{perfStats()?.played.away}</td>
                        <td class="text-center font-bold">
                          {perfStats()?.played.total}
                        </td>
                      </tr>
                      <tr>
                        <td>Wins</td>
                        <td class="text-center text-success">
                          {perfStats()?.wins.home}
                        </td>
                        <td class="text-center text-success">
                          {perfStats()?.wins.away}
                        </td>
                        <td class="text-center font-bold text-success">
                          {perfStats()?.wins.total}
                        </td>
                      </tr>
                      <tr>
                        <td>Draws</td>
                        <td class="text-center text-warning">
                          {perfStats()?.draws.home}
                        </td>
                        <td class="text-center text-warning">
                          {perfStats()?.draws.away}
                        </td>
                        <td class="text-center font-bold text-warning">
                          {perfStats()?.draws.total}
                        </td>
                      </tr>
                      <tr>
                        <td>Losses</td>
                        <td class="text-center text-error">
                          {perfStats()?.losses.home}
                        </td>
                        <td class="text-center text-error">
                          {perfStats()?.losses.away}
                        </td>
                        <td class="text-center font-bold text-error">
                          {perfStats()?.losses.total}
                        </td>
                      </tr>
                      <tr>
                        <td>Goals For</td>
                        <td class="text-center">
                          {perfStats()?.goalsFor.home}
                        </td>
                        <td class="text-center">
                          {perfStats()?.goalsFor.away}
                        </td>
                        <td class="text-center font-bold">
                          {perfStats()?.goalsFor.total}
                        </td>
                      </tr>
                      <tr>
                        <td>Goals Against</td>
                        <td class="text-center">
                          {perfStats()?.goalsAgainst.home}
                        </td>
                        <td class="text-center">
                          {perfStats()?.goalsAgainst.away}
                        </td>
                        <td class="text-center font-bold">
                          {perfStats()?.goalsAgainst.total}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  );
}
