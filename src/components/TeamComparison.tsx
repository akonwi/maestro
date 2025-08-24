import { useSuspenseQueries } from "@tanstack/react-query";
import { Hide } from "./hide";

interface TeamComparisonProps {
  homeTeamId: number;
  awayTeamId: number;
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
}

interface ComparisonData {
  home: TeamStats;
  away: TeamStats;
}

interface PredictionData {
  winner: {
    id: number;
    name: string;
    comment: string;
  };
  win_or_draw: boolean;
  home_goals: string;
  away_goals: string;
  advice: string;
}

export function TeamComparison({
  homeTeamId,
  awayTeamId,
  matchId,
  onClose,
}: TeamComparisonProps) {
  const [comparisonQuery, predictionQuery] = useSuspenseQueries({
    queries: [
      {
        queryKey: ["comparison", { homeTeamId, awayTeamId }],
        queryFn: async function (): Promise<ComparisonData> {
          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/compare?home=${homeTeamId}&away=${awayTeamId}`,
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return response.json();
        },
      },
      {
        queryKey: ["predictions", matchId],
        queryFn: async function (): Promise<PredictionData> {
          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/predictions/${matchId}`,
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return response.json();
        },
      },
    ],
  });

  const error = comparisonQuery.error || predictionQuery.error;

  if (error) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <div className="text-center">
            <h3 className="text-lg font-bold mb-4">Error</h3>
            <p className="text-error mb-4">{error}</p>
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={onClose}></div>
      </div>
    );
  }

  const { home: homeStats, away: awayStats } = comparisonQuery.data;
  const predictions = predictionQuery.data;

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
          <h2 className="text-2xl font-bold">Team Comparison</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Prediction Advice */}
        <div className="alert alert-info mb-6">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <div>
            <div className="font-bold">Match Prediction</div>
            <div className="text-sm">{predictionQuery?.data?.advice}</div>
          </div>
        </div>

        <Hide when={predictionQuery.error == null}>
          <div className="alert alert-warning mb-6">
            <span>Predictions unavailable: {predictionQuery.error}</span>
          </div>
        </Hide>

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

        {/* Predicted Goals */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-4">Match Predictions</h4>

          <StatRow
            label="Predicted Goals"
            homeValue={predictions.home_goals}
            awayValue={predictions.away_goals}
            homeClass="text-info"
            awayClass="text-info"
          />

          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 sm:gap-4 py-2 border-b border-base-200">
            <div className="col-span-1 sm:col-span-2 text-center sm:text-right text-xs sm:text-sm">
              {(() => {
                const avgGoals = homeStats.xgf;
                const predGoals = Math.floor(
                  Math.abs(parseFloat(predictions.home_goals)),
                );
                const diff = predGoals - avgGoals;
                return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
              })()}
            </div>
            <div className="col-span-1 sm:col-span-3 text-center font-medium text-base-content/60 text-xs sm:text-base">
              vs Average
            </div>
            <div className="col-span-1 sm:col-span-2 text-center sm:text-left text-xs sm:text-sm">
              {(() => {
                const avgGoals = awayStats.xgf;
                const predGoals = Math.floor(
                  Math.abs(parseFloat(predictions.away_goals)),
                );
                const diff = predGoals - avgGoals;
                return `${diff > 0 ? "+" : ""}${diff.toFixed(2)}`;
              })()}
            </div>
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
        </div>

        <StatRow
          label="Clean Sheets"
          homeValue={`${homeStats.cleansheets} (${formatCleanSheetPercentage(homeStats)})`}
          awayValue={`${awayStats.cleansheets} (${formatCleanSheetPercentage(awayStats)})`}
        />

        <StatRow
          label="+1 Conceded"
          homeValue={`${homeStats.one_conceded} (${formatOneConcededPercentage(homeStats)})`}
          awayValue={`${awayStats.one_conceded} (${formatOneConcededPercentage(awayStats)})`}
        />

        <StatRow
          label="+2 Conceded"
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
