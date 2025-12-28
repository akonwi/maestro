import { For, Match, Show, Switch, Suspense } from "solid-js";
import { useParams, useSearchParams } from "@solidjs/router";
import { getPerformance } from "~/api/teams";
import { useLeagues } from "~/api/leagues";
import { Fixture, Team } from "~/api/fixtures";
import { GameMetrics } from "~/components/game-metrics";
import { useQuery } from "@tanstack/solid-query";

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

  const recentFormFixtures = () => {
    const all = perf()?.fixtures.all ?? [];
    const completed = all.filter((f) => f.finished);
    const sorted = [...completed].sort((a, b) => a.timestamp - b.timestamp);
    return sorted.slice(-5);
  };

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
    if (!perf()?.fixtures.played.total) return "0";
    const total = perf()!.fixtures.played.total;
    const wins = perf()!.fixtures.wins.total;
    return total > 0 ? ((wins / total) * 100).toFixed(1) : "0";
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
              <GameMetrics teamId={teamId} leagueId={league} season={season} />
            </Suspense>
          </Show>

          {/* Match Statistics */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <h3 class="text-lg font-semibold mb-4">Match Statistics</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center">
                  <div class="text-2xl font-bold">
                    {perf()?.fixtures.played.total}
                  </div>
                  <div class="text-sm text-base-content/60">Matches Played</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-success">
                    {perf()?.fixtures.wins.total}
                  </div>
                  <div class="text-sm text-base-content/60">Wins</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-warning">
                    {perf()?.fixtures.draws.total}
                  </div>
                  <div class="text-sm text-base-content/60">Draws</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-error">
                    {perf()?.fixtures.losses.total}
                  </div>
                  <div class="text-sm text-base-content/60">Losses</div>
                </div>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div class="text-center">
                  <div class="text-xl font-bold">{perf()?.goals.for.total}</div>
                  <div class="text-sm text-base-content/60">Goals For</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">
                    {perf()?.goals.against.total}
                  </div>
                  <div class="text-sm text-base-content/60">Goals Against</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">
                    {perf()?.cleansheets.total}
                  </div>
                  <div class="text-sm text-base-content/60">Clean Sheets</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">
                    {perf()?.failed_to_score.total}
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
                      <td class="text-center">
                        {perf()?.fixtures.played.home}
                      </td>
                      <td class="text-center">
                        {perf()?.fixtures.played.away}
                      </td>
                      <td class="text-center font-bold">
                        {perf()?.fixtures.played.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Wins</td>
                      <td class="text-center text-success">
                        {perf()?.fixtures.wins.home}
                      </td>
                      <td class="text-center text-success">
                        {perf()?.fixtures.wins.away}
                      </td>
                      <td class="text-center font-bold text-success">
                        {perf()?.fixtures.wins.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Draws</td>
                      <td class="text-center text-warning">
                        {perf()?.fixtures.draws.home}
                      </td>
                      <td class="text-center text-warning">
                        {perf()?.fixtures.draws.away}
                      </td>
                      <td class="text-center font-bold text-warning">
                        {perf()?.fixtures.draws.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Losses</td>
                      <td class="text-center text-error">
                        {perf()?.fixtures.losses.home}
                      </td>
                      <td class="text-center text-error">
                        {perf()?.fixtures.losses.away}
                      </td>
                      <td class="text-center font-bold text-error">
                        {perf()?.fixtures.losses.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Goals For</td>
                      <td class="text-center">{perf()?.goals.for.home}</td>
                      <td class="text-center">{perf()?.goals.for.away}</td>
                      <td class="text-center font-bold">
                        {perf()?.goals.for.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Goals Against</td>
                      <td class="text-center">{perf()?.goals.against.home}</td>
                      <td class="text-center">{perf()?.goals.against.away}</td>
                      <td class="text-center font-bold">
                        {perf()?.goals.against.total}
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
