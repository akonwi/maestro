import { useState, useEffect } from "preact/hooks";

interface TeamComparisonProps {
  homeTeamId: number;
  awayTeamId: number;
  onClose: () => void;
}

interface TeamStats {
  id: number;
  name: string;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  cleansheets: number;
  one_conceded: number;
  two_plus_conceded: number;
}

interface ComparisonData {
  home: TeamStats;
  away: TeamStats;
}

export function TeamComparison({
  homeTeamId,
  awayTeamId,
  onClose,
}: TeamComparisonProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComparisonData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/compare?home=${homeTeamId}&away=${awayTeamId}`,
        );

        if (!response.ok) {
          setError(`HTTP error! status: ${response.status}`);
        }

        const comparisonData = await response.json();
        setData(comparisonData);
      } catch (err) {
        console.error("Error fetching comparison data:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to fetch comparison data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchComparisonData();
  }, [homeTeamId, awayTeamId]);

  if (loading) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <div className="flex justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </div>
        <div className="modal-backdrop" onClick={onClose}></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="modal modal-open">
        <div className="modal-box">
          <div className="text-center">
            <h3 className="text-lg font-bold mb-4">Error</h3>
            <p className="text-error mb-4">
              {error || "Failed to load comparison data"}
            </p>
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={onClose}></div>
      </div>
    );
  }

  const { home: homeStats, away: awayStats } = data;

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
    return `${stats.wins}-${stats.losses}-${stats.draws}`;
  };

  const formatGoalRatio = (stats: TeamStats) => {
    return `${stats.goals_for}:${stats.goals_against}`;
  };

  const getGamesPlayed = (stats: TeamStats) => {
    return stats.wins + stats.losses + stats.draws;
  };

  const getGoalDifference = (stats: TeamStats) => {
    return stats.goals_for - stats.goals_against;
  };

  const formatCleanSheetPercentage = (stats: TeamStats) => {
    const gamesPlayed = getGamesPlayed(stats);
    return gamesPlayed > 0 ? `${Math.round((stats.cleansheets / gamesPlayed) * 100)}%` : '0%';
  };

  const getAverageGoalsFor = (stats: TeamStats) => {
    const gamesPlayed = getGamesPlayed(stats);
    return gamesPlayed > 0 ? (stats.goals_for / gamesPlayed).toFixed(2) : '0.00';
  };

  const getAverageGoalsAgainst = (stats: TeamStats) => {
    const gamesPlayed = getGamesPlayed(stats);
    return gamesPlayed > 0 ? (stats.goals_against / gamesPlayed).toFixed(2) : '0.00';
  };

  const getFormRating = (stats: TeamStats) => {
    const gamesPlayed = getGamesPlayed(stats);
    if (gamesPlayed === 0) return 'unknown';
    const winRate = stats.wins / gamesPlayed;
    
    // Research-based thresholds from European league championship data
    // Sources:
    // - Sky Sports: https://www.skysports.com/football/news/11667/10054589/ajax-have-the-best-all-time-win-percentage-in-top-european-football
    // - Bundesliga: https://www.bundesliga.com/en/bundesliga/news/story-of-bayern-munich-record-breaking-11-year-reign-as-bundesliga-champions-27081
    // - American Soccer Analysis: https://www.americansocceranalysis.com/home/2021/7/12/where-goals-come-from-what-it-takes-for-teams-to-be-elite
    // - StatChecker: https://www.statschecker.com/stats/win-draw-win/total-wins-stats
    // - BeSoccer: https://www.besoccer.com/new/bayern-munich-have-best-win-percentage-in-21st-century-842940
    // Research shows mid-table teams typically achieve ~40% win rates, while champions achieve 65-70%
    
    if (winRate >= 0.65) return 'excellent';  // 65%+ (Championship-winning teams)
    if (winRate >= 0.50) return 'good';       // 50-64% (European competition level)
    if (winRate >= 0.35) return 'average';    // 35-49% (Mid-table performance)
    return 'poor';                           // <35% (Relegation zone performance)
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
    <div className="grid grid-cols-7 gap-4 py-2 border-b border-base-200">
      <div className={`col-span-2 text-right ${homeClass}`}>{homeValue}</div>
      <div className="col-span-3 text-center font-medium text-base-content/60">
        {label}
      </div>
      <div className={`col-span-2 text-left ${awayClass}`}>{awayValue}</div>
    </div>
  );

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-2xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Team Comparison</h2>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Team Names */}
        <div className="grid grid-cols-7 gap-4 mb-6">
          <div className="col-span-2 text-center">
            <h3 className="text-xl font-bold">{homeStats.name}</h3>
            <div className="text-sm text-base-content/60">Home</div>
          </div>
          <div className="col-span-3 text-center">
            <div className="text-2xl font-bold">VS</div>
          </div>
          <div className="col-span-2 text-center">
            <h3 className="text-xl font-bold">{awayStats.name}</h3>
            <div className="text-sm text-base-content/60">Away</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold mb-4">Quick Stats</h4>

          <StatRow
            label="Games Played"
            homeValue={getGamesPlayed(homeStats)}
            awayValue={getGamesPlayed(awayStats)}
          />

          <StatRow
            label="W-L-D Record"
            homeValue={formatRecord(homeStats)}
            awayValue={formatRecord(awayStats)}
          />

          <StatRow
            label="Goals (For:Against)"
            homeValue={formatGoalRatio(homeStats)}
            awayValue={formatGoalRatio(awayStats)}
          />

          <StatRow
            label="Goal Difference"
            homeValue={
              getGoalDifference(homeStats) > 0
                ? `+${getGoalDifference(homeStats)}`
                : getGoalDifference(homeStats)
            }
            awayValue={
              getGoalDifference(awayStats) > 0
                ? `+${getGoalDifference(awayStats)}`
                : getGoalDifference(awayStats)
            }
            homeClass={
              getGoalDifference(homeStats) > 0
                ? "text-success"
                : getGoalDifference(homeStats) < 0
                  ? "text-error"
                  : ""
            }
            awayClass={
              getGoalDifference(awayStats) > 0
                ? "text-success"
                : getGoalDifference(awayStats) < 0
                  ? "text-error"
                  : ""
            }
          />
        </div>

        {/* Detailed Stats */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Detailed Stats</h4>

          <StatRow
            label="Clean Sheets"
            homeValue={`${homeStats.cleansheets} (${formatCleanSheetPercentage(homeStats)})`}
            awayValue={`${awayStats.cleansheets} (${formatCleanSheetPercentage(awayStats)})`}
          />

          <div className="grid grid-cols-7 gap-4 py-2 border-b border-base-200">
            <div className="col-span-2 text-right">
              <span
                className={`badge ${getFormBadgeClass(getFormRating(homeStats))}`}
              >
                {getFormRating(homeStats)}
              </span>
            </div>
            <div className="col-span-3 text-center font-medium text-base-content/60">
              Form Rating
            </div>
            <div className="col-span-2 text-left">
              <span
                className={`badge ${getFormBadgeClass(getFormRating(awayStats))}`}
              >
                {getFormRating(awayStats)}
              </span>
            </div>
          </div>

          <StatRow
            label="Avg Goals For"
            homeValue={getAverageGoalsFor(homeStats)}
            awayValue={getAverageGoalsFor(awayStats)}
          />

          <StatRow
            label="Avg Goals Against"
            homeValue={getAverageGoalsAgainst(homeStats)}
            awayValue={getAverageGoalsAgainst(awayStats)}
          />
        </div>

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
