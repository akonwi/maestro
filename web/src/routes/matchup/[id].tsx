import { A, useParams } from "@solidjs/router";
import { createMemo, createSignal, Match, Show, Switch } from "solid-js";
import { type TeamStats, useMatchup } from "~/api/analysis";
import { useFixture, useMatchupForm } from "~/api/fixtures";
import { FormTimeline } from "~/components/form-timeline";
import { ComparisonBar } from "~/components/matchup/comparison-bar";
import { MetricsMatchup } from "~/components/matchup/metrics-matchup";
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

  const analysisQuery = useMatchup(matchId());
  const fixtureQuery = useFixture(matchId());
  const formQuery = useMatchupForm(matchId());

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

  const homeFormFixtures = createMemo(() => formQuery.data?.home ?? []);
  const awayFormFixtures = createMemo(() => formQuery.data?.away ?? []);

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

        <Match when={analysisQuery?.isSuccess && fixtureQuery.isSuccess}>
          {/* Header */}
          <div class="text-sm text-base-content/60">
            {fixture()!.league.name} • {formattedDateTime().date} •{" "}
            {formattedDateTime().time}
          </div>

          {/* Teams Header Card */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body p-4 md:p-8">
              <div class="flex flex-row items-center justify-between gap-2 md:gap-6">
                {/* Home Team */}
                <A
                  href={`/teams/${analysis()!.home.id}?league=${fixture()!.league.id}&season=${fixture()!.season}`}
                  class="flex flex-col items-center gap-1 md:gap-2 flex-1 hover:opacity-80 transition-opacity min-w-0"
                >
                  <img
                    src={logoUrl(analysis()!.home.id)}
                    alt={analysis()!.home.name}
                    class="w-10 h-10 md:w-16 md:h-16"
                  />
                  <div class="text-sm md:text-xl font-bold text-center link-hover truncate w-full">
                    {analysis()!.home.name}
                  </div>
                  <div class="text-xs md:text-sm text-base-content/60">
                    Home
                  </div>
                </A>

                {/* Score / VS */}
                <div class="text-center flex-shrink-0">
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
                  href={`/teams/${analysis()!.away.id}?league=${fixture()!.league.id}&season=${fixture()!.season}`}
                  class="flex flex-col items-center gap-1 md:gap-2 flex-1 hover:opacity-80 transition-opacity min-w-0"
                >
                  <img
                    src={logoUrl(analysis()!.away.id)}
                    alt={analysis()!.away.name}
                    class="w-10 h-10 md:w-16 md:h-16"
                  />
                  <div class="text-sm md:text-xl font-bold text-center link-hover truncate w-full">
                    {analysis()!.away.name}
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
                    formatValue={(v) => v.toString()}
                  />
                  <ComparisonBar
                    label="Goals Conceded"
                    homeValue={homeStats()!.goals_against}
                    awayValue={awayStats()!.goals_against}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                    inverse
                    formatValue={(v) => v.toString()}
                  />
                  <ComparisonBar
                    label="Clean Sheets"
                    homeValue={homeStats()!.cleansheets}
                    awayValue={awayStats()!.cleansheets}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                    formatValue={(v) => v.toString()}
                  />
                  <ComparisonBar
                    label="Win Rate"
                    homeValue={homeStats()!.win_rate}
                    awayValue={awayStats()!.win_rate}
                    homeName={analysis()!.home.name}
                    awayName={analysis()!.away.name}
                    formatValue={(v) => `${(v * 100).toFixed(0)}%`}
                  />
                </div>
              </div>
            </div>
          </Show>

          {/* Attack vs Defense Metrics */}
          <MetricsMatchup
            homeId={analysis()!.home.id}
            awayId={analysis()!.away.id}
            homeName={analysis()!.home.name}
            awayName={analysis()!.away.name}
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
