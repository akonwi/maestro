import { useMatchup } from "../hooks/use-matchup";
import { useMatch } from "../hooks/use-matches";

interface TeamComparisonProps {
  matchId: number;
  onClose: () => void;
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
}

// Match Info Component
function MatchInfo({ matchId }: { matchId: number }) {
  const matchQuery = useMatch(matchId);

  if (matchQuery.isLoading || !matchQuery.data) {
    return <MatchInfoSkeleton />;
  }

  if (matchQuery.isError) {
    return (
      <div className="bg-base-200 rounded-lg p-4 mb-6">
        <div className="text-center text-error">
          Failed to load match information
        </div>
      </div>
    );
  }

  const matchData = matchQuery.data;

  const formatMatchDateTime = (date: string, timestamp: number) => {
    const matchDate = new Date(timestamp * 1000);
    return {
      date: matchDate.toLocaleDateString(),
      time: matchDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
  };

  const getMatchStatus = (
    status: string,
    homeGoals: number,
    awayGoals: number,
  ) => {
    switch (status) {
      case "FT":
        return { text: "Full Time", badge: "badge-neutral" };
      case "NS":
        return { text: "Not Started", badge: "badge-ghost" };
      default:
        return { text: status, badge: "badge-warning" };
    }
  };

  return (
    <>
      <div className="text-sm text-base-content/60 mb-6">
        {formatMatchDateTime(matchData.date, matchData.timestamp).date} •{" "}
        {formatMatchDateTime(matchData.date, matchData.timestamp).time}
      </div>

      <div className="bg-base-200 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="text-center flex-1">
            <div className="font-bold text-lg">{matchData.home_team_name}</div>
            <div className="text-2xl font-bold mt-1">
              {matchData.home_goals}
            </div>
          </div>
          <div className="text-center px-4">
            <div className="text-lg font-bold">VS</div>
            <div className="mt-2">
              <span
                className={`badge ${getMatchStatus(matchData.status, matchData.home_goals, matchData.away_goals).badge}`}
              >
                {
                  getMatchStatus(
                    matchData.status,
                    matchData.home_goals,
                    matchData.away_goals,
                  ).text
                }
              </span>
            </div>
          </div>
          <div className="text-center flex-1">
            <div className="font-bold text-lg">{matchData.away.name}</div>
            <div className="text-2xl font-bold mt-1">
              {matchData.away_goals}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Match Info Skeleton
function MatchInfoSkeleton() {
  return (
    <>
      <div className="animate-pulse bg-base-300 h-4 w-48 rounded mb-6"></div>

      <div className="bg-base-200 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="text-center flex-1">
            <div className="animate-pulse bg-base-300 h-6 w-24 rounded mx-auto mb-2"></div>
            <div className="animate-pulse bg-base-300 h-8 w-8 rounded mx-auto"></div>
          </div>
          <div className="text-center px-4">
            <div className="text-lg font-bold">VS</div>
            <div className="mt-2">
              <div className="animate-pulse bg-base-300 h-6 w-20 rounded"></div>
            </div>
          </div>
          <div className="text-center flex-1">
            <div className="animate-pulse bg-base-300 h-6 w-24 rounded mx-auto mb-2"></div>
            <div className="animate-pulse bg-base-300 h-8 w-8 rounded mx-auto"></div>
          </div>
        </div>
      </div>
    </>
  );
}

export function Matchup({ matchId, onClose }: TeamComparisonProps) {
  const analysisQuery = useMatchup(matchId);

  if (analysisQuery.isError) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <div className="text-center">
            <h3 className="text-lg font-bold mb-4">Error</h3>
            <p className="text-error mb-4">{analysisQuery.error}</p>
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={onClose}></div>
      </div>
    );
  }

  if (analysisQuery.isLoading) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <div className="flex justify-center p-8">
            <div className="loading loading-spinner loading-lg"></div>
          </div>
        </div>
        <div className="modal-backdrop" onClick={onClose}></div>
      </div>
    );
  }

  const { home: homeStats, away: awayStats } = analysisQuery.data.comparison;

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

  const StatRow = ({
    label,
    homeValue,
    awayValue,
    homeClass = "",
    awayClass = "",
  }: {
    label: string;
    homeValue: string | number;
    awayValue: string | number;
    homeClass?: string;
    awayClass?: string;
  }) => (
    <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-4 py-2 border-b border-base-200">
      <div
        className={`col-span-1 sm:col-span-2 text-center sm:text-right text-sm sm:text-base ${homeClass}`}
      >
        {homeValue}
      </div>
      <div className="col-span-1 sm:col-span-3 text-center font-medium text-base-content/60 text-xs sm:text-base">
        {label}
      </div>
      <div
        className={`col-span-1 sm:col-span-2 text-center sm:text-left text-sm sm:text-base ${awayClass}`}
      >
        {awayValue}
      </div>
    </div>
  );

  return (
    <div className="modal modal-open z-50">
      <div className="modal-box max-w-2xl w-11/12 max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Match Details</h2>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Match Info */}
        <MatchInfo matchId={matchId} />

        {/* Team Names - Mobile Responsive */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-4 mb-6">
          <div className="col-span-1 sm:col-span-2 text-center">
            <h3 className="text-lg sm:text-xl font-bold break-words">
              {homeStats.name}
            </h3>
            <div className="text-xs sm:text-sm text-base-content/60">Home</div>
          </div>
          <div className="col-span-1 sm:col-span-3 text-center flex items-center justify-center">
            <div className="text-xl sm:text-2xl font-bold">VS</div>
          </div>
          <div className="col-span-1 sm:col-span-2 text-center">
            <h3 className="text-lg sm:text-xl font-bold break-words">
              {awayStats.name}
            </h3>
            <div className="text-xs sm:text-sm text-base-content/60">Away</div>
          </div>
        </div>

        {/* Team Statistics */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Team Statistics</h4>

          <StatRow
            label="W-D-L Record"
            homeValue={formatRecord(homeStats)}
            awayValue={formatRecord(awayStats)}
          />

          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-4 py-2 border-b border-base-200">
            <div className="col-span-1 sm:col-span-2 text-center sm:text-right">
              <span
                className={`badge badge-sm sm:badge-md ${getFormBadgeClass(getFormRating(homeStats))}`}
              >
                {getFormRating(homeStats)}
              </span>
            </div>
            <div className="col-span-1 sm:col-span-3 text-center font-medium text-base-content/60 text-xs sm:text-base">
              Form Rating
            </div>
            <div className="col-span-1 sm:col-span-2 text-center sm:text-left">
              <span
                className={`badge badge-sm sm:badge-md ${getFormBadgeClass(getFormRating(awayStats))}`}
              >
                {getFormRating(awayStats)}
              </span>
            </div>
          </div>

          <StatRow
            label="GF:GA (Diff)"
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
          />

          <StatRow
            label="Avg Goals For"
            homeValue={homeStats.xgf.toFixed(2)}
            awayValue={awayStats.xgf.toFixed(2)}
          />

          <StatRow
            label="Avg Goals Against"
            homeValue={homeStats.xga.toFixed(2)}
            awayValue={awayStats.xga.toFixed(2)}
          />

          <StatRow
            label="Strike Rate"
            homeValue={formatStrikeRate(homeStats)}
            awayValue={formatStrikeRate(awayStats)}
          />

          <StatRow
            label="+1.5 Goals For"
            homeValue={formatOnePlusScoredPercentage(homeStats)}
            awayValue={formatOnePlusScoredPercentage(awayStats)}
          />
        </div>

        <StatRow
          label="Clean Sheets"
          homeValue={`${homeStats.cleansheets} (${formatCleanSheetPercentage(homeStats)})`}
          awayValue={`${awayStats.cleansheets} (${formatCleanSheetPercentage(awayStats)})`}
        />

        <StatRow
          label="+0.5 Goals Against"
          homeValue={`${homeStats.one_conceded} (${formatOneConcededPercentage(homeStats)})`}
          awayValue={`${awayStats.one_conceded} (${formatOneConcededPercentage(awayStats)})`}
        />

        <StatRow
          label="+1.5 Goals Against"
          homeValue={`${homeStats.two_plus_conceded} (${formatTwoConcededPercentage(homeStats)})`}
          awayValue={`${awayStats.two_plus_conceded} (${formatTwoConcededPercentage(awayStats)})`}
        />

        {/* Close Button */}
        <div className="mt-6 text-center">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
}
