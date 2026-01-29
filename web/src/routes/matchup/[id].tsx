import { A, useParams } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import {
  createMemo,
  createSignal,
  Match,
  Show,
  Suspense,
  Switch,
} from "solid-js";
import {
  matchupStatsQueryOptions,
  teamMetricsQueryOptions,
} from "~/api/analysis";
import { Fixture, fixtureQueryOptions } from "~/api/fixtures";
import { LeagueMenu } from "~/components/league-menu";
import { CornerAnalysis } from "~/components/matchup/corner-analysis";
import { MetricsMatchup } from "~/components/matchup/metrics-matchup";
import { OddsCard } from "~/components/matchup/odds-card";
import { RecentForm } from "~/components/matchup/recent-form";
import { StatComparison } from "~/components/matchup/stat-comparison";
import { StatsTable } from "~/components/matchup/stats-table";
import { useAuth } from "~/contexts/auth";

function logoUrl(id: number) {
  return `https://media.api-sports.io/football/teams/${id}.png`;
}

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

function SectionSkeleton() {
  return (
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
  );
}

function CornerAnalysisSection(props: { fixture: Fixture }) {
  const auth = useAuth();
  const [cornerView, setCornerView] = createSignal<"form" | "season">("form");

  const homeCornerMetricsQuery = useQuery(() => ({
    ...teamMetricsQueryOptions(
      {
        teamId: props.fixture.home.id,
        leagueId: props.fixture.league.id,
        season: props.fixture.season,
        limit: cornerView() === "form" ? 5 : undefined,
        venue: cornerView() === "season" ? "home" : undefined,
      },
      auth.headers,
    ),
    enabled: !props.fixture.finished,
  }));

  const awayCornerMetricsQuery = useQuery(() => ({
    ...teamMetricsQueryOptions(
      {
        teamId: props.fixture.away.id,
        leagueId: props.fixture.league.id,
        season: props.fixture.season,
        limit: cornerView() === "form" ? 5 : undefined,
        venue: cornerView() === "season" ? "away" : undefined,
      },
      auth.headers,
    ),
    enabled: !props.fixture.finished,
  }));

  const cornerProjections = createMemo(() => {
    const home = homeCornerMetricsQuery.data;
    const away = awayCornerMetricsQuery.data;
    if (!home || !away) return undefined;
    const homeFor = home.for.perGame.corners;
    const awayFor = away.for.perGame.corners;
    return {
      homeFor,
      awayFor,
      total: homeFor + awayFor,
    };
  });

  return (
    <>
      <CornerAnalysis
        homeName={props.fixture.home.name}
        awayName={props.fixture.away.name}
        homeMetrics={homeCornerMetricsQuery.data ?? undefined}
        awayMetrics={awayCornerMetricsQuery.data ?? undefined}
        isPending={
          homeCornerMetricsQuery.isPending || awayCornerMetricsQuery.isPending
        }
        hasError={
          homeCornerMetricsQuery.isError || awayCornerMetricsQuery.isError
        }
        view={cornerView()}
        onViewChange={setCornerView}
      />
      <OddsCard
        fixtureId={props.fixture.id}
        homeName={props.fixture.home.name}
        awayName={props.fixture.away.name}
        cornerProjections={cornerProjections()}
      />
    </>
  );
}

function StatsTableSection(props: {
  fixture: Fixture;
  activeTab: () => "season" | "form";
  venueView: () => "contextual" | "full";
}) {
  const statsQuery = useQuery(() => matchupStatsQueryOptions(props.fixture.id));

  const homeStats = createMemo(() => {
    if (props.activeTab() === "form") {
      return (
        statsQuery.data?.form?.home ?? statsQuery.data?.season.home.overall
      );
    }
    const seasonStats = statsQuery.data?.season.home;
    if (!seasonStats) return undefined;
    return props.venueView() === "contextual"
      ? seasonStats.home_only
      : seasonStats.overall;
  });

  const awayStats = createMemo(() => {
    if (props.activeTab() === "form") {
      return (
        statsQuery.data?.form?.away ?? statsQuery.data?.season.away.overall
      );
    }
    const seasonStats = statsQuery.data?.season.away;
    if (!seasonStats) return undefined;
    return props.venueView() === "contextual"
      ? seasonStats.away_only
      : seasonStats.overall;
  });

  return (
    <Show when={homeStats() && awayStats()}>
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <h3 class="text-lg font-semibold mb-4">Detailed Stats</h3>
          <StatsTable
            home={homeStats()!}
            away={awayStats()!}
            homeName={props.fixture.home.name}
            awayName={props.fixture.away.name}
          />
        </div>
      </div>
    </Show>
  );
}

function MetricsSection(props: { fixture: Fixture }) {
  const statsQuery = useQuery(() => matchupStatsQueryOptions(props.fixture.id));

  // Only show form tab if stats loaded successfully and form data exists
  const hasFormData = () =>
    statsQuery.isSuccess && statsQuery.data?.form !== null;

  const [activeTab, setActiveTab] = createSignal<"season" | "form">("form");
  const [venueView, setVenueView] = createSignal<"contextual" | "full">(
    "contextual",
  );

  return (
    <>
      {/* Tabs */}
      <Show when={hasFormData()}>
        <div class="flex items-center justify-between">
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
          <Show when={activeTab() === "season"}>
            <div class="tabs tabs-boxed">
              <button
                type="button"
                class="tab"
                classList={{ "tab-active": venueView() === "contextual" }}
                onClick={() => setVenueView("contextual")}
              >
                Contextual
              </button>
              <button
                type="button"
                class="tab"
                classList={{ "tab-active": venueView() === "full" }}
                onClick={() => setVenueView("full")}
              >
                Full
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* Recent Form */}
      <Suspense fallback={<SectionSkeleton />}>
        <RecentForm
          fixtureId={props.fixture.id}
          homeTeam={props.fixture.home}
          awayTeam={props.fixture.away}
          activeTab={activeTab()}
          venueView={venueView()}
        />
      </Suspense>

      {/* Stat Comparison */}
      <Suspense fallback={<SectionSkeleton />}>
        <StatComparison
          fixtureId={props.fixture.id}
          homeTeam={props.fixture.home}
          awayTeam={props.fixture.away}
          activeTab={activeTab()}
          venueView={venueView()}
        />
      </Suspense>

      {/* Attack vs Defense Metrics */}
      <Suspense fallback={<SectionSkeleton />}>
        <MetricsMatchup
          homeId={props.fixture.home.id}
          awayId={props.fixture.away.id}
          homeName={props.fixture.home.name}
          awayName={props.fixture.away.name}
          leagueId={props.fixture.league.id}
          season={props.fixture.season}
          limit={activeTab() === "form" ? 5 : undefined}
          venueView={activeTab() === "season" ? venueView() : undefined}
        />
      </Suspense>

      {/* Detailed Stats Table */}
      <Suspense fallback={<SectionSkeleton />}>
        <StatsTableSection
          fixture={props.fixture}
          activeTab={activeTab}
          venueView={venueView}
        />
      </Suspense>
    </>
  );
}

export default function MatchupPage() {
  const params = useParams();
  const matchId = () => Number(params.id);

  const fixtureQuery = useQuery(() => fixtureQueryOptions(matchId()));
  const fixture = () => fixtureQuery.data!;

  const formattedDateTime = createMemo(() => {
    if (!fixtureQuery.isSuccess) return { date: "", time: "" };
    const matchDate = new Date(fixture().timestamp);
    return {
      date: matchDate.toLocaleDateString(),
      time: matchDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  return (
    <Switch>
      <Match when={fixtureQuery.isLoading}>
        <MatchupSkeleton />
      </Match>

      <Match when={fixtureQuery.isError}>
        <div class="alert alert-error">
          <span>Failed to load fixture: {fixtureQuery.error?.message}</span>
        </div>
      </Match>

      <Match when>
        <div class="space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <div class="flex items-center justify-between">
            <div class="text-sm text-base-content/60">
              {fixture().league.name} • {formattedDateTime().date} •{" "}
              {formattedDateTime().time}
            </div>
            <LeagueMenu league={fixture().league} trigger="dropdown" />
          </div>

          {/* Teams Header Card */}
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body p-4 md:p-8">
              <div class="flex flex-row items-center justify-between gap-2 md:gap-6">
                {/* Home Team */}
                <A
                  href={`/teams/${fixture().home.id}?league=${fixture().league.id}&season=${fixture().season}`}
                  class="flex flex-col items-center gap-1 md:gap-2 flex-1 hover:opacity-80 transition-opacity min-w-0"
                >
                  <img
                    src={logoUrl(fixture().home.id)}
                    alt={fixture().home.name}
                    class="w-10 h-10 md:w-16 md:h-16"
                  />
                  <div class="text-sm md:text-xl font-bold text-center link-hover truncate w-full">
                    {fixture().home.name}
                  </div>
                  <div class="text-xs md:text-sm text-base-content/60">
                    Home
                  </div>
                </A>

                {/* Score / VS */}
                <div class="text-center shrink-0">
                  <Show
                    when={fixture().finished}
                    fallback={
                      <div class="text-lg md:text-2xl font-bold">VS</div>
                    }
                  >
                    <div class="text-xl md:text-3xl font-bold">
                      {fixture().home_goals} - {fixture().away_goals}
                    </div>
                    <div class="badge badge-neutral badge-sm md:badge-md mt-1 md:mt-2">
                      Full Time
                    </div>
                  </Show>
                </div>

                {/* Away Team */}
                <A
                  href={`/teams/${fixture().away.id}?league=${fixture().league.id}&season=${fixture().season}`}
                  class="flex flex-col items-center gap-1 md:gap-2 flex-1 hover:opacity-80 transition-opacity min-w-0"
                >
                  <img
                    src={logoUrl(fixture().away.id)}
                    alt={fixture().away.name}
                    class="w-10 h-10 md:w-16 md:h-16"
                  />
                  <div class="text-sm md:text-xl font-bold text-center link-hover truncate w-full">
                    {fixture().away.name}
                  </div>
                  <div class="text-xs md:text-sm text-base-content/60">
                    Away
                  </div>
                </A>
              </div>
            </div>
          </div>

          <Show when={!fixture().finished}>
            <Suspense fallback={<SectionSkeleton />}>
              <CornerAnalysisSection fixture={fixtureQuery.data!} />
            </Suspense>
          </Show>

          <Suspense fallback={<SectionSkeleton />}>
            <MetricsSection fixture={fixtureQuery.data!} />
          </Suspense>
        </div>
      </Match>
    </Switch>
  );
}
