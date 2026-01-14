import { useParams, useSearchParams } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  Show,
  Suspense,
  Switch,
} from "solid-js";
import { Fixture, Team } from "~/api/fixtures";
import { useLeagues } from "~/api/leagues";
import { getPerformance } from "~/api/teams";
import { GameMetrics } from "~/components/game-metrics";

type ComputedStats = {
  played: { home: number; away: number; total: number };
  wins: { home: number; away: number; total: number };
  draws: { home: number; away: number; total: number };
  losses: { home: number; away: number; total: number };
  goalsFor: { home: number; away: number; total: number };
  goalsAgainst: { home: number; away: number; total: number };
  cleansheets: { home: number; away: number; total: number };
  failedToScore: { home: number; away: number; total: number };
};

function computeStatsFromFixtures(
  fixtures: Fixture[],
  teamId: number,
): ComputedStats {
  const stats: ComputedStats = {
    played: { home: 0, away: 0, total: 0 },
    wins: { home: 0, away: 0, total: 0 },
    draws: { home: 0, away: 0, total: 0 },
    losses: { home: 0, away: 0, total: 0 },
    goalsFor: { home: 0, away: 0, total: 0 },
    goalsAgainst: { home: 0, away: 0, total: 0 },
    cleansheets: { home: 0, away: 0, total: 0 },
    failedToScore: { home: 0, away: 0, total: 0 },
  };

  for (const f of fixtures) {
    const isHome = f.home.id === teamId;
    const loc = isHome ? "home" : "away";
    const teamGoals = isHome ? f.home_goals : f.away_goals;
    const oppGoals = isHome ? f.away_goals : f.home_goals;

    stats.played[loc]++;
    stats.played.total++;
    stats.goalsFor[loc] += teamGoals;
    stats.goalsFor.total += teamGoals;
    stats.goalsAgainst[loc] += oppGoals;
    stats.goalsAgainst.total += oppGoals;

    if (oppGoals === 0) {
      stats.cleansheets[loc]++;
      stats.cleansheets.total++;
    }
    if (teamGoals === 0) {
      stats.failedToScore[loc]++;
      stats.failedToScore.total++;
    }

    if (f.winner_id === teamId) {
      stats.wins[loc]++;
      stats.wins.total++;
    } else if (f.winner_id === null) {
      stats.draws[loc]++;
      stats.draws.total++;
    } else {
      stats.losses[loc]++;
      stats.losses.total++;
    }
  }

  return stats;
}

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
  const performanceQuery = useQuery(
    getPerformance(() => ({ id: teamId, league, season })),
  );

  const leaguesQuery = useLeagues();

  const isTeamInFollowedLeague = () => {
    if (!league || !leaguesQuery.data) return false;
    return leaguesQuery.data.some((l) => l.id === league && !l.hidden);
  };

  const perf = () => performanceQuery.data;
  const team = () => teamQuery.data;

  const [activeTab, setActiveTab] = createSignal<"season" | "form">("season");

  const recentFormFixtures = () => {
    const all = perf()?.fixtures.all ?? [];
    const completed = all.filter((f) => f.finished);
    const sorted = [...completed].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.slice(-5);
  };

  const formStats = createMemo(() =>
    computeStatsFromFixtures(recentFormFixtures(), teamId),
  );

  const showTabs = () => isTeamInFollowedLeague() && recentFormFixtures().length >= 5;

  // Default to "form" tab when form data becomes available (only on initial load)
  let hasSetDefaultTab = false;
  createEffect(() => {
    if (!hasSetDefaultTab && showTabs()) {
      setActiveTab("form");
      hasSetDefaultTab = true;
    }
  });

  // Reactive stats based on active tab
  const stats = createMemo(() => {
    if (activeTab() === "form") {
      return formStats();
    }
    // Season stats from performance data
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
    } as ComputedStats;
  });

  const formatSummary = (fixture: Fixture) => {
    const isHome = fixture.home.id === teamId;
    const opponent = isHome ? fixture.away.name : fixture.home.name;

    return `${isHome ? "vs" : "at"} ${opponent} (${fixture.home_goals} - ${fixture.away_goals})`;
  };

  const formatOutcome = (fixture: Fixture) => {
    switch (fixture.winner_id) {
      case teamId:
        return "W";
      case null:
        return "D";
      default:
        return "L";
    }
  };

  const getWinRate = () => {
    const s = stats();
    if (!s?.played.total) return "0";
    return s.played.total > 0
      ? ((s.wins.total / s.played.total) * 100).toFixed(1)
      : "0";
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
        <Match when={performanceQuery.error}>
          <div class="alert alert-error">
            <span>
              Failed to load team performance:{" "}
              {performanceQuery.error instanceof Error
                ? performanceQuery.error.message
                : "Unknown error"}
            </span>
          </div>
        </Match>

        <Match when={performanceQuery.isLoading}>
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
                class={`tab ${activeTab() === "season" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("season")}
              >
                Season
              </button>
              <button
                class={`tab ${activeTab() === "form" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("form")}
              >
                Last 5
              </button>
            </div>
          </Show>

          {/* Form */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <h3 class="text-lg font-semibold mb-4">Recent Form</h3>
              <div class="flex gap-2">
                <For each={recentFormFixtures()}>
                  {(fixture) => (
                    <div
                      classList={{
                        "badge-warning": fixture.winner_id === null,
                        "badge-success": fixture.winner_id === teamId,
                        "badge-error":
                          typeof fixture.winner_id === "number" &&
                          fixture.winner_id !== teamId,
                      }}
                      class="badge badge-lg tooltip"
                      data-tip={formatSummary(fixture)}
                    >
                      {formatOutcome(fixture)}
                    </div>
                  )}
                </For>
              </div>
            </div>
          </div>

          {/* Game Metrics */}
          <Show when={isTeamInFollowedLeague()}>
            <Suspense fallback={<GameMetrics.Loading />}>
              <GameMetrics
                teamId={teamId}
                leagueId={league}
                season={season}
                limit={activeTab() === "form" ? 5 : undefined}
              />
            </Suspense>
          </Show>

          {/* Match Statistics */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <h3 class="text-lg font-semibold mb-4">Match Statistics</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center">
                  <div class="text-2xl font-bold">{stats()?.played.total}</div>
                  <div class="text-sm text-base-content/60">Matches Played</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-success">
                    {stats()?.wins.total}
                  </div>
                  <div class="text-sm text-base-content/60">Wins</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-warning">
                    {stats()?.draws.total}
                  </div>
                  <div class="text-sm text-base-content/60">Draws</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-error">
                    {stats()?.losses.total}
                  </div>
                  <div class="text-sm text-base-content/60">Losses</div>
                </div>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div class="text-center">
                  <div class="text-xl font-bold">{stats()?.goalsFor.total}</div>
                  <div class="text-sm text-base-content/60">Goals For</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">
                    {stats()?.goalsAgainst.total}
                  </div>
                  <div class="text-sm text-base-content/60">Goals Against</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">
                    {stats()?.cleansheets.total}
                  </div>
                  <div class="text-sm text-base-content/60">Clean Sheets</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">
                    {stats()?.failedToScore.total}
                  </div>
                  <div class="text-sm text-base-content/60">
                    Failed to Score
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Home vs Away Split */}
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
                      <td class="text-center">{stats()?.played.home}</td>
                      <td class="text-center">{stats()?.played.away}</td>
                      <td class="text-center font-bold">
                        {stats()?.played.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Wins</td>
                      <td class="text-center text-success">
                        {stats()?.wins.home}
                      </td>
                      <td class="text-center text-success">
                        {stats()?.wins.away}
                      </td>
                      <td class="text-center font-bold text-success">
                        {stats()?.wins.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Draws</td>
                      <td class="text-center text-warning">
                        {stats()?.draws.home}
                      </td>
                      <td class="text-center text-warning">
                        {stats()?.draws.away}
                      </td>
                      <td class="text-center font-bold text-warning">
                        {stats()?.draws.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Losses</td>
                      <td class="text-center text-error">
                        {stats()?.losses.home}
                      </td>
                      <td class="text-center text-error">
                        {stats()?.losses.away}
                      </td>
                      <td class="text-center font-bold text-error">
                        {stats()?.losses.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Goals For</td>
                      <td class="text-center">{stats()?.goalsFor.home}</td>
                      <td class="text-center">{stats()?.goalsFor.away}</td>
                      <td class="text-center font-bold">
                        {stats()?.goalsFor.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Goals Against</td>
                      <td class="text-center">{stats()?.goalsAgainst.home}</td>
                      <td class="text-center">{stats()?.goalsAgainst.away}</td>
                      <td class="text-center font-bold">
                        {stats()?.goalsAgainst.total}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}
