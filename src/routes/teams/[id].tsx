import { For, Match, Show, Switch, Suspense } from "solid-js";
import { useParams, useSearchParams } from "@solidjs/router";
import { useTeamStatistics } from "~/api/team-statistics";
import { useLeagues } from "~/api/leagues";
import { Fixture, useFixtures } from "~/api/fixtures";
import { GameMetrics } from "~/components/game-metrics";

export default function TeamStatsPage() {
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const teamId = Number(routeParams.id);
  const league = Number(searchParams.league);
  const season = Number(searchParams.season);

  const teamStatsQuery = useTeamStatistics(teamId, league, season);
  const leaguesQuery = useLeagues();
  const fixturesQuery = useFixtures(() => ({
    leagueId: league,
    season: season,
    teamId: teamId,
  }));

  const isTeamInFollowedLeague = () => {
    if (!league || !leaguesQuery.data) return false;
    return leaguesQuery.data.some((l) => l.id === league && !l.hidden);
  };

  const stats = () => teamStatsQuery.data?.response;
  const team = () => stats()?.team;
  const leagueInfo = () => stats()?.league;
  const fixtures = () => stats()?.fixtures;
  const goals = () => stats()?.goals;
  const biggest = () => stats()?.biggest;
  const cleanSheets = () => stats()?.clean_sheet;
  const failedToScore = () => stats()?.failed_to_score;
  const penalty = () => stats()?.penalty;

  const formatPercentage = (value: string | null | undefined) => {
    if (!value) return "0%";
    return value;
  };

  const recentFormFixtures = () => {
    const completed = fixturesQuery.data?.filter((f) => f.finished) ?? [];
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
    if (!fixtures()) return "0";
    const total = fixtures()!.played.total;
    const wins = fixtures()!.wins.total;
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
        <Match when={teamStatsQuery.error}>
          <div class="alert alert-error">
            <span>
              Failed to load team statistics:{" "}
              {teamStatsQuery.error instanceof Error
                ? teamStatsQuery.error.message
                : "Unknown error"}
            </span>
          </div>
        </Match>

        <Match when={teamStatsQuery.isLoading}>
          <div class="flex w-52 flex-col gap-4">
            <div class="skeleton h-32 w-full"></div>
            <div class="skeleton h-4 w-28"></div>
            <div class="skeleton h-4 w-full"></div>
            <div class="skeleton h-4 w-full"></div>
          </div>
        </Match>

        <Match when={teamStatsQuery.data}>
          {/* Team Header */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <div class="flex items-center gap-4">
                <img src={team()?.logo} alt={team()?.name} class="w-16 h-16" />
                <div class="flex-1">
                  <h2 class="text-2xl font-bold">{team()?.name}</h2>
                  <div class="text-base-content/60">
                    {leagueInfo()?.name} • {leagueInfo()?.season}
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
                    {fixtures()?.played.total}
                  </div>
                  <div class="text-sm text-base-content/60">Matches Played</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-success">
                    {fixtures()?.wins.total}
                  </div>
                  <div class="text-sm text-base-content/60">Wins</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-warning">
                    {fixtures()?.draws.total}
                  </div>
                  <div class="text-sm text-base-content/60">Draws</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-error">
                    {fixtures()?.loses.total}
                  </div>
                  <div class="text-sm text-base-content/60">Losses</div>
                </div>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div class="text-center">
                  <div class="text-xl font-bold">
                    {goals()?.for.total.total}
                  </div>
                  <div class="text-sm text-base-content/60">Goals For</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">
                    {goals()?.against.total.total}
                  </div>
                  <div class="text-sm text-base-content/60">Goals Against</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">{cleanSheets()?.total}</div>
                  <div class="text-sm text-base-content/60">Clean Sheets</div>
                </div>
                <div class="text-center">
                  <div class="text-xl font-bold">{failedToScore()?.total}</div>
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
                      <td class="text-center">{fixtures()?.played.home}</td>
                      <td class="text-center">{fixtures()?.played.away}</td>
                      <td class="text-center font-bold">
                        {fixtures()?.played.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Wins</td>
                      <td class="text-center text-success">
                        {fixtures()?.wins.home}
                      </td>
                      <td class="text-center text-success">
                        {fixtures()?.wins.away}
                      </td>
                      <td class="text-center font-bold text-success">
                        {fixtures()?.wins.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Draws</td>
                      <td class="text-center text-warning">
                        {fixtures()?.draws.home}
                      </td>
                      <td class="text-center text-warning">
                        {fixtures()?.draws.away}
                      </td>
                      <td class="text-center font-bold text-warning">
                        {fixtures()?.draws.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Losses</td>
                      <td class="text-center text-error">
                        {fixtures()?.loses.home}
                      </td>
                      <td class="text-center text-error">
                        {fixtures()?.loses.away}
                      </td>
                      <td class="text-center font-bold text-error">
                        {fixtures()?.loses.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Goals For</td>
                      <td class="text-center">{goals()?.for.total.home}</td>
                      <td class="text-center">{goals()?.for.total.away}</td>
                      <td class="text-center font-bold">
                        {goals()?.for.total.total}
                      </td>
                    </tr>
                    <tr>
                      <td>Goals Against</td>
                      <td class="text-center">{goals()?.against.total.home}</td>
                      <td class="text-center">{goals()?.against.total.away}</td>
                      <td class="text-center font-bold">
                        {goals()?.against.total.total}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Goal Timing */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <h3 class="text-lg font-semibold mb-4">Goal Timing</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 class="font-medium mb-3">Goals For</h4>
                  <div class="space-y-2">
                    <For each={Object.entries(goals()?.for.minute || {})}>
                      {([timeRange, data]) => (
                        <Show when={data.total !== null}>
                          <div class="flex justify-between items-center">
                            <span class="text-sm">{timeRange}</span>
                            <div class="flex items-center gap-2">
                              <span class="font-medium">{data.total}</span>
                              <span class="text-xs text-base-content/60 badge badge-ghost">
                                {formatPercentage(data.percentage)}
                              </span>
                            </div>
                          </div>
                        </Show>
                      )}
                    </For>
                  </div>
                </div>
                <div>
                  <h4 class="font-medium mb-3">Goals Against</h4>
                  <div class="space-y-2">
                    <For each={Object.entries(goals()?.against.minute || {})}>
                      {([timeRange, data]) => (
                        <Show when={data.total !== null}>
                          <div class="flex justify-between items-center">
                            <span class="text-sm">{timeRange}</span>
                            <div class="flex items-center gap-2">
                              <span class="font-medium">{data.total}</span>
                              <span class="text-xs text-base-content/60 badge badge-ghost">
                                {formatPercentage(data.percentage)}
                              </span>
                            </div>
                          </div>
                        </Show>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Biggest Results */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <h3 class="text-lg font-semibold mb-4">Biggest Results</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 class="font-medium mb-3 text-success">Biggest Wins</h4>
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <span>Home:</span>
                      <span class="font-medium">{biggest()?.wins.home}</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Away:</span>
                      <span class="font-medium">{biggest()?.wins.away}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 class="font-medium mb-3 text-error">Biggest Losses</h4>
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <span>Home:</span>
                      <span class="font-medium">{biggest()?.loses.home}</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Away:</span>
                      <span class="font-medium">{biggest()?.loses.away}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 class="font-medium mb-3">Goal Scoring Records</h4>
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <span>Most Goals For (Home):</span>
                      <span class="font-medium">
                        {biggest()?.goals.for.home}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span>Most Goals For (Away):</span>
                      <span class="font-medium">
                        {biggest()?.goals.for.away}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 class="font-medium mb-3">Goal Conceding Records</h4>
                  <div class="space-y-2">
                    <div class="flex justify-between">
                      <span>Most Goals Against (Home):</span>
                      <span class="font-medium">
                        {biggest()?.goals.against.home}
                      </span>
                    </div>
                    <div class="flex justify-between">
                      <span>Most Goals Against (Away):</span>
                      <span class="font-medium">
                        {biggest()?.goals.against.away}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Penalties */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <h3 class="text-lg font-semibold mb-4">Penalty Record</h3>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div class="text-center">
                  <div class="text-2xl font-bold">{penalty()?.total}</div>
                  <div class="text-sm text-base-content/60">
                    Total Penalties
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-success">
                    {penalty()?.scored.total}
                  </div>
                  <div class="text-sm text-base-content/60">Scored</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold text-error">
                    {penalty()?.missed.total}
                  </div>
                  <div class="text-sm text-base-content/60">Missed</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-bold">
                    {formatPercentage(penalty()?.scored.percentage)}
                  </div>
                  <div class="text-sm text-base-content/60">Success Rate</div>
                </div>
              </div>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}
