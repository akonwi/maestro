import { useMemo } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../utils/database";
import {
  calculateTeamStatistics,
  formatRecord,
  formatGoalRatio,
  formatCleanSheetPercentage,
  formatAverage,
  getFormRating,
} from "../utils/statistics";

interface TeamComparisonProps {
  homeTeamId: string;
  awayTeamId: string;
  onClose: () => void;
}

export function TeamComparison({
  homeTeamId,
  awayTeamId,
  onClose,
}: TeamComparisonProps) {
  const data = useLiveQuery(async () => {
    const [teams, matches] = await Promise.all([
      db.teams.orderBy("name").toArray(),
      db.matches.toArray(),
    ]);

    return { teams, matches };
  });

  const homeTeam = data?.teams.find((t) => t.id === homeTeamId);
  const awayTeam = data?.teams.find((t) => t.id === awayTeamId);

  const { homeStats, awayStats } = useMemo(() => {
    if (!data?.matches) {
      return { homeStats: null, awayStats: null };
    }

    return {
      homeStats: calculateTeamStatistics(homeTeamId, data.matches),
      awayStats: calculateTeamStatistics(awayTeamId, data.matches),
    };
  }, [homeTeamId, awayTeamId, data?.matches]);

  if (!data || !homeTeam || !awayTeam || !homeStats || !awayStats) {
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

  const getFormBadgeClass = (rating: string) => {
    switch (rating) {
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
              <h3 className="text-xl font-bold">{homeTeam.name}</h3>
              <div className="text-sm text-base-content/60">Home</div>
            </div>
            <div className="col-span-3 text-center">
              <div className="text-2xl font-bold">VS</div>
            </div>
            <div className="col-span-2 text-center">
              <h3 className="text-xl font-bold">{awayTeam.name}</h3>
              <div className="text-sm text-base-content/60">Away</div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-4">Quick Stats</h4>

            <StatRow
              label="Games Played"
              homeValue={homeStats.gamesPlayed}
              awayValue={awayStats.gamesPlayed}
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
                homeStats.goalDifference > 0
                  ? `+${homeStats.goalDifference}`
                  : homeStats.goalDifference
              }
              awayValue={
                awayStats.goalDifference > 0
                  ? `+${awayStats.goalDifference}`
                  : awayStats.goalDifference
              }
              homeClass={
                homeStats.goalDifference > 0
                  ? "text-success"
                  : homeStats.goalDifference < 0
                    ? "text-error"
                    : ""
              }
              awayClass={
                awayStats.goalDifference > 0
                  ? "text-success"
                  : awayStats.goalDifference < 0
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
              homeValue={`${homeStats.cleanSheets} (${formatCleanSheetPercentage(homeStats)})`}
              awayValue={`${awayStats.cleanSheets} (${formatCleanSheetPercentage(awayStats)})`}
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
              homeValue={formatAverage(homeStats.averageGoalsFor)}
              awayValue={formatAverage(awayStats.averageGoalsFor)}
            />

            <StatRow
              label="Avg Goals Against"
              homeValue={formatAverage(homeStats.averageGoalsAgainst)}
              awayValue={formatAverage(awayStats.averageGoalsAgainst)}
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
