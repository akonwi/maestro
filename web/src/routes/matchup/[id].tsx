import { useParams } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import { type TeamStats, useMatchup } from "~/api/analysis";
import { type Fixture, useFixture } from "~/api/fixtures";
import { getPerformance } from "~/api/teams";
import { ComparisonBar } from "~/components/matchup/comparison-bar";
import { FormTimeline } from "~/components/matchup/form-timeline";
import { StatsTable } from "~/components/matchup/stats-table";

function logoUrl(id: number) {
  return `https://media.api-sports.io/football/teams/${id}.png`;
}

const getGamesPlayed = (stats: TeamStats) =>
  stats.wins + stats.losses + stats.draws;

const getFormRating = (stats: TeamStats) => {
  const gamesPlayed = getGamesPlayed(stats);
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

function MatchupSkeleton() {
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

function getRecentFormFixtures(
  allFixtures: Fixture[],
  limit?: number,
): Fixture[] {
  const completed = allFixtures.filter(f => f.finished);
  const sorted = [...completed].sort((a, b) => b.timestamp - a.timestamp);
  return limit ? sorted.slice(0, limit) : sorted;
}

export default function MatchupPage() {
  const params = useParams();
  const matchId = () => Number(params.id);

  const analysisQuery = useMatchup(matchId());
  const fixtureQuery = useFixture(matchId());

  const homePerformanceQuery = useQuery(() => {
    const f = fixtureQuery.data;
    const a = analysisQuery.data;
    if (!f || !a) return { queryKey: ["disabled"], enabled: false };
    return getPerformance(() => ({
      id: a.home.id,
      league: f.league.id,
      season: f.season,
    }))();
  });

  const awayPerformanceQuery = useQuery(() => {
    const f = fixtureQuery.data;
    const a = analysisQuery.data;
    if (!f || !a) return { queryKey: ["disabled"], enabled: false };
    return getPerformance(() => ({
      id: a.away.id,
      league: f.league.id,
      season: f.season,
    }))();
  });

  const hasFormData = () => {
    const form = analysisQuery.data?.form;
    return (
      form?.home &&
      form?.away &&
      form.home.num_games >= 5 &&
      form.away.num_games >= 5
    );
  };

  const [activeTab, setActiveTab] = createSignal<"season" | "form">("form");

  const homeFormFixtures = createMemo(() => {
    const perf = homePerformanceQuery.data;
    if (!perf) return [];
    const limit = activeTab() === "form" ? 5 : undefined;
    return getRecentFormFixtures(perf.fixtures.all, limit);
  });

  const awayFormFixtures = createMemo(() => {
    const perf = awayPerformanceQuery.data;
    if (!perf) return [];
    const limit = activeTab() === "form" ? 5 : undefined;
    return getRecentFormFixtures(perf.fixtures.all, limit);
  });

  const homeStats = createMemo(() =>
    activeTab() === "season"
      ? analysisQuery.data?.comparison.home
      : (analysisQuery.data?.form?.home ?? analysisQuery.data?.comparison.home),
  );

  const awayStats = createMemo(() =>
    activeTab() === "season"
      ? analysisQuery.data?.comparison.away
      : (analysisQuery.data?.form?.away ?? analysisQuery.data?.comparison.away),
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

  const fixture = () => fixtureQuery.data;
  const analysis = () => analysisQuery.data;

  return (
    <div class="space-y-6 max-w-4xl mx-auto">
      <Switch>
        <Match when={analysisQuery.error || fixtureQuery.error}>
          <div class="alert alert-error">
            <span>
              Failed to load matchup:{" "}
              {analysisQuery.error?.message ?? fixtureQuery.error?.message}
            </span>
          </div>
        </Match>

        <Match when={analysisQuery.isLoading || fixtureQuery.isLoading}>
          <MatchupSkeleton />
        </Match>

        <Match when={analysis() && fixture()}>
          {/* Header */}
          <div class="text-sm text-base-content/60">
            {fixture()!.league.name} • {formattedDateTime().date} •{" "}
            {formattedDateTime().time}
          </div>

          {/* Teams Header Card */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <div class="flex flex-col md:flex-row items-center justify-between gap-6">
                {/* Home Team */}
                <div class="flex flex-col items-center gap-2 flex-1">
                  <img
                    src={logoUrl(analysis()!.home.id)}
                    alt={analysis()!.home.name}
                    class="w-16 h-16"
                  />
                  <div class="text-xl font-bold text-center">
                    {analysis()!.home.name}
                  </div>
                  <div class="text-sm text-base-content/60">Home</div>
                </div>

                {/* Score / VS */}
                <div class="text-center">
                  <Show
                    when={fixture()!.finished}
                    fallback={<div class="text-2xl font-bold">VS</div>}
                  >
                    <div class="text-3xl font-bold">
                      {fixture()!.home_goals} - {fixture()!.away_goals}
                    </div>
                    <div class="badge badge-neutral mt-2">Full Time</div>
                  </Show>
                </div>

                {/* Away Team */}
                <div class="flex flex-col items-center gap-2 flex-1">
                  <img
                    src={logoUrl(analysis()!.away.id)}
                    alt={analysis()!.away.name}
                    class="w-16 h-16"
                  />
                  <div class="text-xl font-bold text-center">
                    {analysis()!.away.name}
                  </div>
                  <div class="text-sm text-base-content/60">Away</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Show when={hasFormData()}>
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

          {/* Recent Form */}
          <Show when={homeStats() && awayStats()}>
            <div class="card bg-base-100 border border-base-300">
              <div class="card-body">
                <h3 class="text-lg font-semibold mb-4">Recent Form</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Home Form */}
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-medium">{analysis()!.home.name}</span>
                      <span
                        class={`badge ${getFormBadgeClass(getFormRating(homeStats()!))}`}
                      >
                        {getFormRating(homeStats()!)}
                      </span>
                    </div>
                    <FormTimeline
                      fixtures={homeFormFixtures()}
                      teamId={analysis()!.home.id}
                    />
                    <div class="text-sm text-base-content/60 mt-2">
                      {homeStats()!.wins}W - {homeStats()!.draws}D -{" "}
                      {homeStats()!.losses}L
                    </div>
                  </div>

                  {/* Away Form */}
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <span class="font-medium">{analysis()!.away.name}</span>
                      <span
                        class={`badge ${getFormBadgeClass(getFormRating(awayStats()!))}`}
                      >
                        {getFormRating(awayStats()!)}
                      </span>
                    </div>
                    <FormTimeline
                      fixtures={awayFormFixtures()}
                      teamId={analysis()!.away.id}
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

          {/* Comparison Bars */}
          <Show when={homeStats() && awayStats()}>
            <div class="card bg-base-100 border border-base-300">
              <div class="card-body">
                <h3 class="text-lg font-semibold mb-4">Stat Comparison</h3>
                <div class="space-y-4">
                  <ComparisonBar
                    label="Expected Goals For (xGF)"
                    homeValue={homeStats()!.xgf}
                    awayValue={awayStats()!.xgf}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                  />
                  <ComparisonBar
                    label="Expected Goals Against (xGA)"
                    homeValue={homeStats()!.xga}
                    awayValue={awayStats()!.xga}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                    inverse
                  />
                  <ComparisonBar
                    label="Goals Scored"
                    homeValue={homeStats()!.goals_for}
                    awayValue={awayStats()!.goals_for}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                    formatValue={v => v.toString()}
                  />
                  <ComparisonBar
                    label="Goals Conceded"
                    homeValue={homeStats()!.goals_against}
                    awayValue={awayStats()!.goals_against}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                    inverse
                    formatValue={v => v.toString()}
                  />
                  <ComparisonBar
                    label="Clean Sheets"
                    homeValue={homeStats()!.cleansheets}
                    awayValue={awayStats()!.cleansheets}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                    formatValue={v => v.toString()}
                  />
                  <ComparisonBar
                    label="Win Rate"
                    homeValue={homeStats()!.win_rate}
                    awayValue={awayStats()!.win_rate}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                    formatValue={v => `${(v * 100).toFixed(0)}%`}
                  />
                </div>
              </div>
            </div>
          </Show>

          {/* Detailed Stats Table */}
          <Show when={homeStats() && awayStats()}>
            <div class="card bg-base-100 border border-base-300">
              <div class="card-body">
                <h3 class="text-lg font-semibold mb-4">Detailed Stats</h3>
                <StatsTable
                  home={homeStats()!}
                  away={awayStats()!}
                  homeName={analysis()!.home.name}
                  awayName={analysis()!.away.name}
                />
              </div>
            </div>
          </Show>
        </Match>
      </Switch>
    </div>
  );
}
