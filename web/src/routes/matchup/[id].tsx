import { ContextMenu } from "@kobalte/core/context-menu";
import { A, useParams } from "@solidjs/router";
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
import {
  matchupStatsQueryOptions,
  teamMetricsQueryOptions,
} from "~/api/analysis";
import { Bet, betsQueryOptions, useDeleteBet, useUpdateBet } from "~/api/bets";
import {
  Fixture,
  fixtureOddsQueryOptions,
  fixtureQueryOptions,
  fixtureStatsQueryOptions,
} from "~/api/fixtures";
import { LeagueMenu } from "~/components/league-menu";
import { ComparisonBar } from "~/components/matchup/comparison-bar";
import { CornerPickCard } from "~/components/matchup/corner-pick";
import { MetricsMatchup } from "~/components/matchup/metrics-matchup";
import { RecentForm } from "~/components/matchup/recent-form";
import { StatComparison } from "~/components/matchup/stat-comparison";
import { StatsTable } from "~/components/matchup/stats-table";
import { useAuth } from "~/contexts/auth";
import {
  calculateProfit,
  formatCurrency,
  formatFixtureTime,
} from "~/lib/formatters";

function logoUrl(id: number) {
  return `https://media.api-sports.io/football/teams/${id}.png`;
}

const LIVE_STATUSES = new Set([
  "1H",
  "HT",
  "2H",
  "ET",
  "P",
  "BT",
  "INT",
  "LIVE",
]);

const fixtureStatusLabel = (fixture: { status: string; timestamp: number }) =>
  fixture.status === "NS"
    ? formatFixtureTime(fixture.timestamp)
    : fixture.status;

const shouldShowScore = (fixture: { finished: boolean; status: string }) =>
  fixture.finished || LIVE_STATUSES.has(fixture.status);

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

function MatchStatsSection(props: { fixture: Fixture }) {
  const statsQuery = useQuery(() => fixtureStatsQueryOptions(props.fixture.id));

  const stats = createMemo(() => {
    const home = statsQuery.data?.home;
    const away = statsQuery.data?.away;
    if (!home || !away) return null;
    return {
      home,
      away,
      homePossession: home.possession * 100,
      awayPossession: away.possession * 100,
    };
  });

  return (
    <div class="space-y-4">
      <MatchBetsSection fixtureId={props.fixture.id} />
      <Switch>
        <Match when={statsQuery.isError}>
          <div class="alert alert-error">
            <span>Failed to load match stats.</span>
          </div>
        </Match>
        <Match when={statsQuery.isPending}>
          <SectionSkeleton />
        </Match>
        <Match when={stats()}>
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <h3 class="text-lg font-semibold mb-4">Match Stats</h3>
              <div class="space-y-4">
                <ComparisonBar
                  label="Shots"
                  homeValue={stats()!.home.shots}
                  awayValue={stats()!.away.shots}
                  homeName={props.fixture.home.name}
                  awayName={props.fixture.away.name}
                  formatValue={(v) => v.toString()}
                />
                <ComparisonBar
                  label="Shots on Target"
                  homeValue={stats()!.home.shots_on_goal}
                  awayValue={stats()!.away.shots_on_goal}
                  homeName={props.fixture.home.name}
                  awayName={props.fixture.away.name}
                  formatValue={(v) => v.toString()}
                />
                <ComparisonBar
                  label="Corners"
                  homeValue={stats()!.home.corners}
                  awayValue={stats()!.away.corners}
                  homeName={props.fixture.home.name}
                  awayName={props.fixture.away.name}
                  formatValue={(v) => v.toString()}
                />
                <ComparisonBar
                  label="Possession"
                  homeValue={stats()!.homePossession}
                  awayValue={stats()!.awayPossession}
                  homeName={props.fixture.home.name}
                  awayName={props.fixture.away.name}
                  formatValue={(v) => `${Math.round(v)}%`}
                />
                <ComparisonBar
                  label="Fouls"
                  homeValue={stats()!.home.fouls}
                  awayValue={stats()!.away.fouls}
                  homeName={props.fixture.home.name}
                  awayName={props.fixture.away.name}
                  formatValue={(v) => v.toString()}
                />
                <ComparisonBar
                  label="Yellow Cards"
                  homeValue={stats()!.home.yellow_cards}
                  awayValue={stats()!.away.yellow_cards}
                  homeName={props.fixture.home.name}
                  awayName={props.fixture.away.name}
                  formatValue={(v) => v.toString()}
                />
                <ComparisonBar
                  label="Red Cards"
                  homeValue={stats()!.home.red_cards}
                  awayValue={stats()!.away.red_cards}
                  homeName={props.fixture.home.name}
                  awayName={props.fixture.away.name}
                  formatValue={(v) => v.toString()}
                />
                <ComparisonBar
                  label="xG"
                  homeValue={stats()!.home.xg}
                  awayValue={stats()!.away.xg}
                  homeName={props.fixture.home.name}
                  awayName={props.fixture.away.name}
                  formatValue={(v) => v.toFixed(2)}
                />
              </div>
            </div>
          </div>
        </Match>
        <Match when>
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body">
              <div class="text-sm text-base-content/60">
                Match stats are not available yet.
              </div>
            </div>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

function CornerPickSection(props: { fixture: Fixture }) {
  const auth = useAuth();

  const homeCornerFormQuery = useQuery(() => ({
    ...teamMetricsQueryOptions(
      {
        teamId: props.fixture.home.id,
        leagueId: props.fixture.league.id,
        season: props.fixture.season,
        limit: 5,
      },
      auth.headers,
    ),
    enabled: !props.fixture.finished,
  }));

  const awayCornerFormQuery = useQuery(() => ({
    ...teamMetricsQueryOptions(
      {
        teamId: props.fixture.away.id,
        leagueId: props.fixture.league.id,
        season: props.fixture.season,
        limit: 5,
      },
      auth.headers,
    ),
    enabled: !props.fixture.finished,
  }));

  const homeCornerSeasonQuery = useQuery(() => ({
    ...teamMetricsQueryOptions(
      {
        teamId: props.fixture.home.id,
        leagueId: props.fixture.league.id,
        season: props.fixture.season,
      },
      auth.headers,
    ),
    enabled: !props.fixture.finished,
  }));

  const awayCornerSeasonQuery = useQuery(() => ({
    ...teamMetricsQueryOptions(
      {
        teamId: props.fixture.away.id,
        leagueId: props.fixture.league.id,
        season: props.fixture.season,
      },
      auth.headers,
    ),
    enabled: !props.fixture.finished,
  }));

  const homeCornerVenueQuery = useQuery(() => ({
    ...teamMetricsQueryOptions(
      {
        teamId: props.fixture.home.id,
        leagueId: props.fixture.league.id,
        season: props.fixture.season,
        venue: "home",
      },
      auth.headers,
    ),
    enabled: !props.fixture.finished,
  }));

  const awayCornerVenueQuery = useQuery(() => ({
    ...teamMetricsQueryOptions(
      {
        teamId: props.fixture.away.id,
        leagueId: props.fixture.league.id,
        season: props.fixture.season,
        venue: "away",
      },
      auth.headers,
    ),
    enabled: !props.fixture.finished,
  }));

  const oddsQuery = useQuery(() => fixtureOddsQueryOptions(props.fixture.id));

  return (
    <>
      <CornerPickCard
        fixture={props.fixture}
        odds={oddsQuery.data}
        form={{
          home: homeCornerFormQuery.data,
          away: awayCornerFormQuery.data,
        }}
        season={{
          home: homeCornerSeasonQuery.data,
          away: awayCornerSeasonQuery.data,
        }}
        venue={{
          home: homeCornerVenueQuery.data,
          away: awayCornerVenueQuery.data,
        }}
        isPending={
          oddsQuery.isPending ||
          homeCornerFormQuery.isPending ||
          awayCornerFormQuery.isPending ||
          homeCornerSeasonQuery.isPending ||
          awayCornerSeasonQuery.isPending ||
          homeCornerVenueQuery.isPending ||
          awayCornerVenueQuery.isPending
        }
        hasError={
          oddsQuery.isError ||
          homeCornerFormQuery.isError ||
          awayCornerFormQuery.isError ||
          homeCornerSeasonQuery.isError ||
          awayCornerSeasonQuery.isError ||
          homeCornerVenueQuery.isError ||
          awayCornerVenueQuery.isError
        }
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

function MatchBetsSection(props: { fixtureId: number }) {
  const betsQuery = useQuery(() =>
    betsQueryOptions({ matchId: props.fixtureId }),
  );
  const updateBet = useUpdateBet();
  const deleteBet = useDeleteBet();
  const auth = useAuth();

  const bets = () => betsQuery.data?.bets ?? [];

  const resultBadge = (result: Bet["result"]) => {
    switch (result) {
      case "win":
        return <span class="badge badge-success">Win</span>;
      case "lose":
        return <span class="badge badge-error">Loss</span>;
      case "push":
        return <span class="badge badge-warning">Push</span>;
      default:
        return <span class="badge badge-ghost">Pending</span>;
    }
  };

  const handleDelete = async (betId: number) => {
    if (confirm("Are you sure you want to delete this bet?")) {
      deleteBet.mutate(betId);
    }
  };

  const pnlValue = (bet: Bet) => {
    if (bet.result === "win") {
      return (
        <span class="text-success">
          +{formatCurrency(calculateProfit(bet.amount, bet.odds))}
        </span>
      );
    }
    if (bet.result === "lose") {
      return <span class="text-error">-{formatCurrency(bet.amount)}</span>;
    }
    if (bet.result === "pending") {
      return (
        <span class="text-warning">
          +{formatCurrency(calculateProfit(bet.amount, bet.odds))}
        </span>
      );
    }
    return <span class="text-base-content/70">{formatCurrency(0)}</span>;
  };

  return (
    <Switch>
      <Match when={betsQuery.isError}>
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <div class="text-error text-sm">Failed to load match bets.</div>
          </div>
        </div>
      </Match>
      <Match when={betsQuery.isPending}>
        <SectionSkeleton />
      </Match>
      <Match when={bets().length === 0}>
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <h3 class="text-lg font-semibold mb-2">Match Bets</h3>
            <div class="text-sm text-base-content/60">No bets recorded.</div>
          </div>
        </div>
      </Match>
      <Match when>
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">Match Bets</h3>
              <Show when={auth.isReadOnly()}>
                <span class="text-xs text-base-content/60">
                  Add API token to update outcomes
                </span>
              </Show>
            </div>
            <div class="overflow-x-auto">
              <table class="table table-zebra w-full select-none">
                <thead>
                  <tr>
                    <th>Bet</th>
                    <th>Odds</th>
                    <th>Wager</th>
                    <th>P&L</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  <For each={bets()}>
                    {(bet) => (
                      <ContextMenu>
                        <ContextMenu.Trigger as="tr">
                          <td class="font-medium">{bet.name}</td>
                          <td>{bet.odds > 0 ? `+${bet.odds}` : bet.odds}</td>
                          <td>{formatCurrency(bet.amount)}</td>
                          <td>{pnlValue(bet)}</td>
                          <td>{resultBadge(bet.result)}</td>
                        </ContextMenu.Trigger>
                        <ContextMenu.Portal>
                          <Show when={!auth.isReadOnly()}>
                            <ContextMenu.Content class="dropdown-content menu shadow bg-base-100 rounded-box w-32">
                              <ContextMenu.Group>
                                <ContextMenu.GroupLabel
                                  as="li"
                                  class="menu-title"
                                >
                                  Set Result
                                </ContextMenu.GroupLabel>
                                <ContextMenu.Item
                                  as="li"
                                  class="hover:cursor-default"
                                  onClick={() =>
                                    updateBet.mutate({
                                      id: bet.id,
                                      result: "win",
                                    })
                                  }
                                >
                                  <ContextMenu.ItemLabel>
                                    Win
                                  </ContextMenu.ItemLabel>
                                </ContextMenu.Item>
                                <ContextMenu.Item
                                  as="li"
                                  class="hover:cursor-default"
                                  onClick={() =>
                                    updateBet.mutate({
                                      id: bet.id,
                                      result: "lose",
                                    })
                                  }
                                >
                                  <ContextMenu.ItemLabel>
                                    Lose
                                  </ContextMenu.ItemLabel>
                                </ContextMenu.Item>
                                <ContextMenu.Item
                                  as="li"
                                  class="hover:cursor-default"
                                  onClick={() =>
                                    updateBet.mutate({
                                      id: bet.id,
                                      result: "push",
                                    })
                                  }
                                >
                                  <ContextMenu.ItemLabel>
                                    Push
                                  </ContextMenu.ItemLabel>
                                </ContextMenu.Item>
                              </ContextMenu.Group>
                              <ContextMenu.Separator
                                as="div"
                                class="divider m-0"
                              />
                              <ContextMenu.Item
                                as="li"
                                class="hover:cursor-default"
                                onClick={() => handleDelete(bet.id)}
                              >
                                <ContextMenu.ItemLabel class="text-error">
                                  Delete
                                </ContextMenu.ItemLabel>
                              </ContextMenu.Item>
                            </ContextMenu.Content>
                          </Show>
                        </ContextMenu.Portal>
                      </ContextMenu>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Match>
    </Switch>
  );
}

function PreMatchSection(props: { fixture: Fixture }) {
  return (
    <>
      <Suspense fallback={<SectionSkeleton />}>
        <MetricsSection fixture={props.fixture} />
      </Suspense>

      <Show when={!props.fixture.finished}>
        <Suspense fallback={<SectionSkeleton />}>
          <CornerPickSection fixture={props.fixture} />
        </Suspense>
      </Show>
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

  const isLive = createMemo(() =>
    fixtureQuery.data ? shouldShowScore(fixtureQuery.data) : false,
  );
  const [activeTab, setActiveTab] = createSignal<"stats" | "prematch">(
    "prematch",
  );
  const [userSetTab, setUserSetTab] = createSignal(false);

  createEffect(() => {
    if (isLive() && !userSetTab()) {
      setActiveTab("stats");
    }
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
                    when={shouldShowScore(fixture())}
                    fallback={
                      <div class="text-lg md:text-2xl font-bold">
                        {fixtureStatusLabel(fixture())}
                      </div>
                    }
                  >
                    <div class="text-xl md:text-3xl font-bold">
                      {fixture().home_goals} - {fixture().away_goals}
                    </div>
                    <div class="badge badge-neutral badge-sm md:badge-md mt-1 md:mt-2">
                      {fixtureStatusLabel(fixture())}
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

          <Show
            when={isLive()}
            fallback={<PreMatchSection fixture={fixture()} />}
          >
            <div class="tabs tabs-boxed w-fit">
              <button
                type="button"
                class="tab"
                classList={{ "tab-active": activeTab() === "stats" }}
                onClick={() => {
                  setActiveTab("stats");
                  setUserSetTab(true);
                }}
              >
                Match Stats
              </button>
              <button
                type="button"
                class="tab"
                classList={{ "tab-active": activeTab() === "prematch" }}
                onClick={() => {
                  setActiveTab("prematch");
                  setUserSetTab(true);
                }}
              >
                Pre-match
              </button>
            </div>

            <Show when={activeTab() === "stats"}>
              <MatchStatsSection fixture={fixture()} />
            </Show>
            <Show when={activeTab() === "prematch"}>
              <PreMatchSection fixture={fixture()} />
            </Show>
          </Show>
        </div>
      </Match>
    </Switch>
  );
}
