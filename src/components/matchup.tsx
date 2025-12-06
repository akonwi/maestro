import {
  createSignal,
  For,
  Match,
  Switch,
  Show,
  createMemo,
  Suspense,
  useContext,
} from "solid-js";
import { AnalysisData, useMatchup } from "~/api/analysis";
import { useFixture } from "~/api/fixtures";
import { JuiceFixture } from "~/hooks/data/use-juice";
import { BetFormProps } from "./bet-form";
import { useTrackLeague, useLeagues, useToggleLeague } from "~/api/leagues";
import { DotsVerticalIcon } from "./icons/dots-vertical";
import { Toast, toaster } from "@kobalte/core/toast";
import { useAuth } from "~/contexts/auth";
import { A } from "@solidjs/router";
import { BetFormContext } from "./bet-form.context";

interface TeamComparisonProps {
  matchId: number;
  onClose: () => void;
  valueBets?: JuiceFixture;
}

interface TeamStats {
  id: number;
  name: string;
  num_games: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goals_diff: number;
  xgf: number;
  xga: number;
  cleansheets: number;
  one_conceded: number;
  two_plus_conceded: number;
  win_rate: number;
  strike_rate: number;
  one_plus_scored: number;
  position: number;
}

// Match Info Skeleton
export function MatchInfoSkeleton() {
  return (
    <div>
      <div class="animate-pulse bg-base-300 h-4 w-48 rounded mb-6"></div>

      <div class="bg-base-200 rounded-lg p-4 mb-6">
        <div class="flex justify-between items-center">
          <div class="text-center flex-1">
            <div class="animate-pulse bg-base-300 h-6 w-24 rounded mx-auto mb-2"></div>
            <div class="animate-pulse bg-base-300 h-8 w-8 rounded mx-auto"></div>
          </div>
          <div class="text-center px-4">
            <div class="text-lg font-bold">VS</div>
            <div class="mt-2">
              <div class="animate-pulse bg-base-300 h-6 w-20 rounded"></div>
            </div>
          </div>
          <div class="text-center flex-1">
            <div class="animate-pulse bg-base-300 h-6 w-24 rounded mx-auto mb-2"></div>
            <div class="animate-pulse bg-base-300 h-8 w-8 rounded mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Match Info Component
function MatchInfo({ matchId }: { matchId: number }) {
  const matchQuery = useFixture(matchId);
  const league = () => matchQuery.data?.league;
  const trackLeague = useTrackLeague();
  const toggleLeague = useToggleLeague();
  const leaguesQuery = useLeagues();
  const auth = useAuth();

  const leagueStatus = (): "hidden" | "followed" | null => {
    const currentLeague = league();
    if (!currentLeague) return null;

    const knownLeague = () =>
      leaguesQuery.data?.find((l) => l.id === currentLeague.id);
    if (knownLeague() == undefined) return null;
    return knownLeague()?.hidden ? "hidden" : "followed";
  };

  if (matchQuery.isError) {
    return (
      <div class="bg-base-200 rounded-lg p-4 mb-6">
        <div class="text-center text-error">
          Failed to load match information
        </div>
      </div>
    );
  }

  const formattedDateTime = createMemo(() => {
    const timestamp = matchQuery.data?.timestamp ?? Date.now();
    const matchDate = new Date(timestamp * 1000);
    return {
      date: matchDate.toLocaleDateString(),
      time: matchDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  });

  const formattedStatus = createMemo(() => {
    switch (matchQuery?.data?.status) {
      case "FT":
        return { text: "Full Time", color: "badge-neutral" };
      case "NS":
        return { text: "Not Started", color: "badge-ghost" };
      default:
        return { text: matchQuery.data?.status, color: "badge-warning" };
    }
  });

  const onLeagueHidden = () => {
    const id = toaster.show((props) => (
      <Toast
        toastId={props.toastId}
        class="alert bordered border-base-300 w-full flex justify-between"
      >
        <Toast.Title>{league()?.name} will be hidden in the future</Toast.Title>
        <Toast.CloseButton
          class="btn btn-sm"
          onClick={() => toaster.dismiss(id)}
        >
          ×
        </Toast.CloseButton>
      </Toast>
    ));
  };

  const onLeagueFollowed = () => {
    const id = toaster.show((props) => (
      <Toast
        toastId={props.toastId}
        class="alert bordered border-base-300 w-full flex justify-between"
      >
        <Toast.Title>
          {league()?.name} will be followed in the future
        </Toast.Title>
        <Toast.CloseButton
          class="btn btn-sm"
          onClick={() => toaster.dismiss(id)}
        >
          ×
        </Toast.CloseButton>
      </Toast>
    ));
  };

  return (
    <>
      <div class="flex justify-between items-center mb-6">
        <div class="text-sm text-base-content/60">
          {league()?.name} • {""}
          {formattedDateTime().date} • {formattedDateTime().time}
        </div>

        <Show when={!auth.isReadOnly()}>
          <div class="dropdown dropdown-end">
            <div tabIndex={0} role="button" class="btn btn-sm btn-ghost">
              <DotsVerticalIcon />
            </div>
            <ul
              tabIndex={0}
              class="dropdown-content z-1 menu p-2 shadow bg-base-100 rounded-box w-52"
            >
              <Switch>
                <Match when={leagueStatus() == null}>
                  <li>
                    <a
                      onClick={() =>
                        trackLeague.mutate(
                          { id: league()!.id, name: league()!.name },
                          { onSuccess: onLeagueFollowed },
                        )
                      }
                    >
                      Follow League
                    </a>
                  </li>
                  <li>
                    <a
                      onClick={() =>
                        trackLeague.mutate(
                          {
                            id: league()!.id,
                            name: league()!.name,
                            hidden: true,
                          },
                          {
                            onSettled: onLeagueHidden,
                          },
                        )
                      }
                    >
                      Hide League
                    </a>
                  </li>
                </Match>

                <Match when={leagueStatus() === "followed"}>
                  <li>
                    <a
                      onClick={() =>
                        toggleLeague.mutate(
                          {
                            id: league()!.id,
                            hidden: true,
                          },
                          {
                            onSettled: onLeagueHidden,
                          },
                        )
                      }
                    >
                      {leagueStatus() === "followed" ? "Hide" : "Follow"} League
                    </a>
                  </li>
                </Match>

                <Match when={leagueStatus() === "hidden"}>
                  <li>
                    <a
                      onClick={() =>
                        toggleLeague.mutate(
                          {
                            id: league()!.id,
                            hidden: false,
                          },
                          {
                            onSuccess: onLeagueFollowed,
                          },
                        )
                      }
                    >
                      {leagueStatus() === "followed" ? "Hide" : "Follow"} League
                    </a>
                  </li>
                </Match>
              </Switch>
            </ul>
          </div>
        </Show>
      </div>

      <div class="bg-base-200 rounded-lg p-4 mb-6">
        <div class="flex justify-between items-center">
          <div class="text-center flex-1 text-2xl font-bold">
            {matchQuery.data?.home_goals}
          </div>
          <div class="text-center px-4">
            <div class="text-lg font-bold">VS</div>
            <div class="mt-2">
              <span class={`badge ${formattedStatus().color}`}>
                {formattedStatus().text}
              </span>
            </div>
          </div>
          <div class="text-center flex-1 text-2xl font-bold">
            {matchQuery.data?.away_goals}
          </div>
        </div>
      </div>
    </>
  );
}

export function Matchup({ matchId, onClose, valueBets }: TeamComparisonProps) {
  const analysisQuery = useMatchup(matchId);

  // Bet form state
  const [showBetForm, setShowBetForm] = createSignal(false);
  const [prefilledBet, setPrefilledBet] = createSignal<
    BetFormProps["initialData"] | null
  >(null);

  const handleRecordBet = (
    type_id: number,
    description: string,
    odds: number,
    line?: number,
  ) => {
    setPrefilledBet({ description, odds, type_id, line });
    setShowBetForm(true);
  };

  const handleBetCreated = () => {
    setShowBetForm(false);
    setPrefilledBet(null);
  };

  const handleCancelBet = () => {
    setShowBetForm(false);
    setPrefilledBet(null);
  };

  return (
    <div class="modal modal-open z-50">
      <div class="modal-box max-w-2xl w-11/12 max-h-screen overflow-y-auto">
        <Switch>
          <Match when={analysisQuery.error}>
            <div class="text-center">
              <h3 class="text-lg font-bold mb-4">Error</h3>
              <p class="text-error mb-4">{analysisQuery.error?.message}</p>
              <button class="btn btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          </Match>

          <Match when={analysisQuery.data != null}>
            {/* Header */}
            <div class="flex justify-between items-center mb-6">
              <div>
                <h2 class="text-2xl font-bold">Match Details</h2>
              </div>
              <button class="btn btn-sm btn-ghost" onClick={onClose}>
                ×
              </button>
            </div>

            {/* Match Info */}
            <Suspense fallback={<MatchInfoSkeleton />}>
              <MatchInfo matchId={matchId} />
            </Suspense>

            <Comparison
              {...analysisQuery.data!}
              juiceData={valueBets}
              matchId={matchId}
            />

            {/* Close Button */}
            <div class="mt-6 text-center">
              <button class="btn btn-primary" onClick={onClose}>
                Close
              </button>
            </div>
          </Match>
        </Switch>
      </div>
      <div class="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}

export function MatchupSkeleton() {
  return (
    <div>
      <div class="animate-pulse bg-base-300 h-20 w-48 rounded mb-6"></div>
    </div>
  );
}

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

const formatRecord = (stats: TeamStats) => {
  return `${stats.wins}-${stats.draws}-${stats.losses}`;
};

const formatGoalRatio = (stats: TeamStats) => {
  const diff =
    stats.goals_diff > 0 ? `+${stats.goals_diff}` : `${stats.goals_diff}`;
  return `${stats.goals_for}:${stats.goals_against} (${diff})`;
};

const getGamesPlayed = (stats: TeamStats) => {
  return stats.wins + stats.losses + stats.draws;
};

const formatCleanSheetPercentage = (stats: TeamStats) => {
  const gamesPlayed = getGamesPlayed(stats);
  return gamesPlayed > 0
    ? `${Math.round((stats.cleansheets / gamesPlayed) * 100)}%`
    : "0%";
};

const formatOneConcededPercentage = (stats: TeamStats) => {
  const gamesPlayed = getGamesPlayed(stats);
  return gamesPlayed > 0
    ? `${Math.round((stats.one_conceded / gamesPlayed) * 100)}%`
    : "0%";
};

const formatTwoConcededPercentage = (stats: TeamStats) => {
  const gamesPlayed = getGamesPlayed(stats);
  return gamesPlayed > 0
    ? `${Math.round((stats.two_plus_conceded / gamesPlayed) * 100)}%`
    : "0%";
};

const formatStrikeRate = (stats: TeamStats) => {
  return stats.strike_rate.toFixed(1);
};

const formatOnePlusScoredPercentage = (stats: TeamStats) => {
  const gamesPlayed = getGamesPlayed(stats);
  return (stats.one_plus_scored / gamesPlayed).toFixed(1);
};

const getFormRating = (stats: TeamStats) => {
  const gamesPlayed = getGamesPlayed(stats);
  if (gamesPlayed === 0) return "unknown";
  const winRate = stats.wins / gamesPlayed;

  // Research-based thresholds from European league championship data
  // Sources:
  // - Sky Sports: https://www.skysports.com/football/news/11667/10054589/ajax-have-the-best-all-time-win-percentage-in-top-european-football
  // - Bundesliga: https://www.bundesliga.com/en/bundesliga/news/story-of-bayern-munich-record-breaking-11-year-reign-as-bundesliga-champions-27081
  // - American Soccer Analysis: https://www.americansocceranalysis.com/home/2021/7/12/where-goals-come-from-what-it-takes-for-teams-to-be-elite
  // - StatChecker: https://www.statschecker.com/stats/win-draw-win/total-wins-stats
  // - BeSoccer: https://www.besoccer.com/new/bayern-munich-have-best-win-percentage-in-21st-century-842940
  // Research shows mid-table teams typically achieve ~40% win rates, while champions achieve 65-70%

  if (winRate >= 0.65) return "excellent"; // 65%+ (Championship-winning teams)
  if (winRate >= 0.5) return "good"; // 50-64% (European competition level)
  if (winRate >= 0.35) return "average"; // 35-49% (Mid-table performance)
  return "poor"; // <35% (Relegation zone performance)
};

const formatOdds = (odd: number) => {
  if (odd > 0) {
    return `+${odd}`;
  }
  return odd.toString();
};

// Bet type IDs
const MATCH_OUTCOME = 1;
const HOME_TOTAL_GOALS = 16;
const HOME_CLEANSHEET = 27;
const AWAY_TOTAL_GOALS = 17;
const AWAY_CLEANSHEET = 28;

const StatRow = ({
  matchId,
  label,
  homeValue,
  awayValue,
  homeClass = "",
  awayClass = "",
  juiceData: juiceData,
}: {
  matchId: number;
  label: string;
  homeValue: string | number;
  awayValue: string | number;
  homeClass?: string;
  awayClass?: string;
  juiceData?: JuiceFixture;
}) => {
  const auth = useAuth();
  const [_, betForm] = useContext(BetFormContext);
  type Highlight = {
    text: string;
    typeId: number;
    description: string;
    odds: number;
    line?: number;
  };

  const homeHighlights: Array<Highlight> = [];
  const awayHighlights: Array<Highlight> = [];

  // Map betting markets to stat labels
  juiceData?.stats.forEach((betType) => {
    betType.values.forEach((value) => {
      let formattedValue = value.name;

      // Format Over/Under to +/- signs
      if (formattedValue.toLowerCase().includes("over")) {
        formattedValue = formattedValue.replace(/over\s*/i, "+");
      }
      if (formattedValue.toLowerCase().includes("under")) {
        formattedValue = formattedValue.replace(/under\s*/i, "-");
      }

      const betText = `${formattedValue}: ${formatOdds(value.odd)}`;
      const description = `${betType.name} - ${value.name}`;
      // Extract line value from bet name (e.g., "Over 2.5" -> 2.5, "Under 2.5" -> -2.5)
      const line = ((): number | undefined => {
        const match = value.name.match(/(\d+\.?\d*)/);
        if (!match || !match[1]) return undefined;

        const numValue = parseFloat(match[1]);
        // Make negative for "Under" bets
        return value.name.toLowerCase().includes("under")
          ? -numValue
          : numValue;
      })();

      // Match Outcome mapping
      if (betType.id === MATCH_OUTCOME && label === "W-D-L Record") {
        if (value.name === "Home") {
          homeHighlights.push({
            text: betText,
            typeId: betType.id,
            description: description,
            odds: value.odd,
            line: line,
          });
        } else if (value.name === "Away") {
          awayHighlights.push({
            text: betText,
            typeId: betType.id,
            description: description,
            odds: value.odd,
            line: line,
          });
        }
      }

      // Home Total Goals mapping
      if (betType.id === HOME_TOTAL_GOALS && label === "Avg Goals For") {
        homeHighlights.push({
          text: betText,
          typeId: betType.id,
          description: description,
          odds: value.odd,
          line: line,
        });
      }

      // Away Total Goals mapping
      if (betType.id === AWAY_TOTAL_GOALS && label === "Avg Goals For") {
        awayHighlights.push({
          text: betText,
          typeId: betType.id,
          description: description,
          odds: value.odd,
          line: line,
        });
      }

      // Home Clean Sheet mapping
      if (betType.id === HOME_CLEANSHEET && label === "Clean Sheets") {
        homeHighlights.push({
          text: betText,
          typeId: betType.id,
          description: description,
          odds: value.odd,
          line: line,
        });
      }

      // Away Clean Sheet mapping
      if (betType.id === AWAY_CLEANSHEET && label === "Clean Sheets") {
        awayHighlights.push({
          text: betText,
          typeId: betType.id,
          description: description,
          odds: value.odd,
          line: line,
        });
      }
    });
  });

  return (
    <div class="py-2 border-b border-base-200">
      <div class="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-4 items-center">
        {/* Home side with bet highlights on the left */}
        <div class="col-span-1 sm:col-span-2 flex items-center justify-end gap-2">
          <div class="flex flex-wrap gap-1 justify-end">
            <For each={homeHighlights}>
              {(highlight) => (
                <span
                  class="badge badge-accent badge-xs cursor-pointer hover:badge-accent-focus transition-colors"
                  onClick={() => {
                    if (auth.isReadOnly()) return;

                    betForm.show(matchId, {
                      type_id: highlight.typeId,
                      description: highlight.description,
                      odds: highlight.odds,
                      line: highlight.line,
                    });
                  }}
                >
                  {highlight.text}
                </span>
              )}
            </For>
          </div>
          <div
            class={`text-center sm:text-right text-sm sm:text-base ${homeClass}`}
          >
            {homeValue}
          </div>
        </div>

        {/* Center label */}
        <div class="col-span-1 sm:col-span-3 text-center font-medium text-base-content/60 text-xs sm:text-base">
          {label}
        </div>

        {/* Away side with bet highlights on the right */}
        <div class="col-span-1 sm:col-span-2 flex items-center justify-start gap-2">
          <div
            class={`text-center sm:text-left text-sm sm:text-base ${awayClass}`}
          >
            {awayValue}
          </div>
          <div class="flex flex-wrap gap-1 justify-start">
            <For each={awayHighlights}>
              {(highlight) => (
                <span
                  class="badge badge-accent badge-xs cursor-pointer hover:badge-accent-focus transition-colors"
                  onClick={() => {
                    if (auth.isReadOnly()) return;

                    betForm.show(matchId, {
                      type_id: highlight.typeId,
                      description: highlight.description,
                      odds: highlight.odds,
                      line: highlight.line,
                    });
                  }}
                >
                  {highlight.text}
                </span>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
};

function Comparison(
  props: AnalysisData & { juiceData?: JuiceFixture; matchId: number },
) {
  const { home: homeStats, away: awayStats } = props.comparison;

  // Get match data to extract league and season info
  const matchQuery = useFixture(props.matchId);
  const match = () => matchQuery.data;

  const auth = useAuth();
  const teamHref = (teamId: number) => {
    if (auth.isReadOnly()) {
      // Return current URL with hash to make it a no-op but preserve search params
      const currentUrl = new URL(location.href);
      return `${currentUrl.pathname}${currentUrl.search}#`;
    }
    const f = match();
    return `/teams/${teamId}?league=${f?.league.id}&season=${f?.league.season}`;
  };

  return (
    <>
      {/* Team Names - Mobile Responsive */}
      <div class="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-4 mb-6">
        <div class="col-span-1 sm:col-span-2 text-center">
          <h3 class="text-lg sm:text-xl font-bold wrap-break-word cursor-pointer hover:text-primary transition-colors">
            <A href={teamHref(props.comparison.home.id)}>
              {homeStats.name}
              {homeStats.position > 0 ? ` (#${homeStats.position})` : ""}
            </A>
          </h3>
          <div class="text-xs sm:text-sm text-base-content/60">Home</div>
        </div>
        <div class="col-span-1 sm:col-span-3 text-center flex items-center justify-center">
          <div class="text-xl sm:text-2xl font-bold">VS</div>
        </div>
        <div class="col-span-1 sm:col-span-2 text-center">
          <h3 class="text-lg sm:text-xl font-bold wrap-break-word cursor-pointer hover:text-primary transition-colors">
            <A href={teamHref(props.comparison.away.id)}>
              {awayStats.name}
              {awayStats.position > 0 ? ` (#${awayStats.position})` : ""}
            </A>
          </h3>
          <div class="text-xs sm:text-sm text-base-content/60">Away</div>
        </div>
      </div>

      {/* Team Statistics */}
      <div>
        <h4 class="text-lg font-semibold mb-4">Team Statistics</h4>

        <StatRow
          label="W-D-L Record"
          juiceData={props.juiceData}
          homeValue={formatRecord(homeStats)}
          awayValue={formatRecord(awayStats)}
          matchId={props.matchId}
        />

        <div class="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-4 py-2 border-b border-base-200">
          <div class="col-span-1 sm:col-span-2 text-center sm:text-right">
            <span
              class={`badge badge-sm sm:badge-md ${getFormBadgeClass(getFormRating(homeStats))}`}
            >
              {getFormRating(homeStats)}
            </span>
          </div>
          <div class="col-span-1 sm:col-span-3 text-center font-medium text-base-content/60 text-xs sm:text-base">
            Form Rating
          </div>
          <div class="col-span-1 sm:col-span-2 text-center sm:text-left">
            <span
              class={`badge badge-sm sm:badge-md ${getFormBadgeClass(getFormRating(awayStats))}`}
            >
              {getFormRating(awayStats)}
            </span>
          </div>
        </div>

        <StatRow
          label="GF:GA (Diff)"
          juiceData={props.juiceData}
          homeValue={formatGoalRatio(homeStats)}
          awayValue={formatGoalRatio(awayStats)}
          homeClass={
            homeStats.goals_diff > 0
              ? "text-success"
              : homeStats.goals_diff < 0
                ? "text-error"
                : ""
          }
          awayClass={
            awayStats.goals_diff > 0
              ? "text-success"
              : awayStats.goals_diff < 0
                ? "text-error"
                : ""
          }
          matchId={props.matchId}
        />

        <StatRow
          matchId={props.matchId}
          label="Avg Goals For"
          juiceData={props.juiceData}
          homeValue={homeStats.xgf.toFixed(2)}
          awayValue={awayStats.xgf.toFixed(2)}
        />

        <StatRow
          matchId={props.matchId}
          label="Avg Goals Against"
          juiceData={props.juiceData}
          homeValue={homeStats.xga.toFixed(2)}
          awayValue={awayStats.xga.toFixed(2)}
        />

        <StatRow
          matchId={props.matchId}
          label="Strike Rate"
          juiceData={props.juiceData}
          homeValue={formatStrikeRate(homeStats)}
          awayValue={formatStrikeRate(awayStats)}
        />

        <StatRow
          matchId={props.matchId}
          label="+1.5 Goals For"
          juiceData={props.juiceData}
          homeValue={formatOnePlusScoredPercentage(homeStats)}
          awayValue={formatOnePlusScoredPercentage(awayStats)}
        />
      </div>

      <StatRow
        matchId={props.matchId}
        label="Clean Sheets"
        juiceData={props.juiceData}
        homeValue={`${homeStats.cleansheets} (${formatCleanSheetPercentage(homeStats)})`}
        awayValue={`${awayStats.cleansheets} (${formatCleanSheetPercentage(awayStats)})`}
      />

      <StatRow
        matchId={props.matchId}
        label="+0.5 Goals Against"
        juiceData={props.juiceData}
        homeValue={`${homeStats.one_conceded} (${formatOneConcededPercentage(homeStats)})`}
        awayValue={`${awayStats.one_conceded} (${formatOneConcededPercentage(awayStats)})`}
      />

      <StatRow
        matchId={props.matchId}
        label="+1.5 Goals Against"
        juiceData={props.juiceData}
        homeValue={`${homeStats.two_plus_conceded} (${formatTwoConcededPercentage(homeStats)})`}
        awayValue={`${awayStats.two_plus_conceded} (${formatTwoConcededPercentage(awayStats)})`}
      />
    </>
  );
}
