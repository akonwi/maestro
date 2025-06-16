import { useMemo, useState } from "preact/hooks";
import { db } from "../utils/database";
import {
  calculateTeamStatistics,
  formatRecord,
  formatGoalRatio,
  formatCleanSheetPercentage,
  formatAverage,
  getFormRating,
} from "../utils/statistics";
import { formatMatchDate } from "../utils/helpers";
import { useLiveQuery } from "dexie-react-hooks";
import { useParams } from "react-router";

export function TeamDetail() {
  const params = useParams();
  const teamId = params.teamId!;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const [team, homeMatches, awayMatches, allTeams] = await Promise.all([
      db.teams.get(teamId),
      db.matches.where("homeId").equals(teamId).toArray(),
      db.matches.where("awayId").equals(teamId).toArray(),
      db.teams.toArray(),
    ]);
    const allMatches = [...homeMatches, ...awayMatches].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    return { team, matches: allMatches, teams: allTeams };
  }, [teamId]);

  const stats = useMemo(() => {
    if (data?.matches == null) return null;
    return calculateTeamStatistics(teamId, data.matches);
  }, [data]);

  const getTeamName = (teamId: string) => {
    const team = data?.teams?.find((t) => t.id === teamId);
    return team ? team.name : "Unknown Team";
  };

  const handleEditStart = () => {
    setEditName(data?.team?.name || "");
    setIsEditing(true);
    setError(null);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditName("");
    setError(null);
  };

  const handleEditSave = async () => {
    if (!editName.trim()) {
      setError("Team name cannot be empty");
      return;
    }

    if (!data?.team) return;

    try {
      const updatedTeam = { ...data.team, name: editName.trim() };
      await db.teams.put(updatedTeam);
      setIsEditing(false);
      setEditName("");
      setError(null);
    } catch (err) {
      setError("Failed to update team name");
      console.error("Error updating team:", err);
    }
  };

  if (data == null) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (data.team == null) {
    return null;
  }

  const { team, matches, teams } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/maestro/" className="btn btn-ghost btn-sm">
            ← Teams
          </a>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input input-bordered text-3xl font-bold"
                value={editName}
                onInput={(e) =>
                  setEditName((e.target as HTMLInputElement).value)
                }
                autoFocus
              />
              <button
                className="btn btn-sm btn-success"
                onClick={handleEditSave}
              >
                Save
              </button>
              <button
                className="btn btn-sm btn-ghost"
                onClick={handleEditCancel}
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1 className="text-3xl font-bold">{team.name}</h1>
          )}
        </div>
        {!isEditing && (
          <button className="btn btn-sm btn-outline" onClick={handleEditStart}>
            Edit Name
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <h2 className="card-title">Team Information</h2>
              <div className="space-y-2">
                <p>
                  <span className="font-semibold">Name:</span> {team.name}
                </p>
                <p>
                  <span className="font-semibold">Created:</span>{" "}
                  {team.createdAt.toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <h2 className="card-title">Quick Stats</h2>
              {stats && (
                <div className="stats stats-vertical border border-base-300">
                  <div className="stat">
                    <div className="stat-title">Games</div>
                    <div className="stat-value">{stats.gamesPlayed}</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">W-L-D</div>
                    <div className="stat-value text-sm">
                      {formatRecord(stats)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Goals</div>
                    <div className="stat-value text-sm">
                      {formatGoalRatio(stats)}
                    </div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Goal Diff</div>
                    <div
                      className={`stat-value text-sm ${stats.goalDifference >= 0 ? "text-success" : "text-error"}`}
                    >
                      {stats.goalDifference >= 0 ? "+" : ""}
                      {stats.goalDifference}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <h2 className="card-title">Detailed Stats</h2>
              {stats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-base-content/60">
                        Clean Sheets
                      </div>
                      <div className="text-lg font-semibold">
                        {stats.cleanSheets} ({formatCleanSheetPercentage(stats)}
                        )
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-base-content/60">
                        Form Rating
                      </div>
                      <div
                        className={`badge ${
                          getFormRating(stats) === "excellent"
                            ? "badge-success"
                            : getFormRating(stats) === "good"
                              ? "badge-info"
                              : getFormRating(stats) === "average"
                                ? "badge-warning"
                                : "badge-error"
                        }`}
                      >
                        {getFormRating(stats)}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-base-content/60">
                        Avg Goals For
                      </div>
                      <div className="text-lg font-semibold">
                        {formatAverage(stats.averageGoalsFor)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-base-content/60">
                        Avg Goals Against
                      </div>
                      <div className="text-lg font-semibold">
                        {formatAverage(stats.averageGoalsAgainst)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          <h2 className="card-title">Recent Matches</h2>
          {matches.length === 0 ? (
            <div className="text-center py-8 text-base-content/60">
              No matches recorded yet
            </div>
          ) : (
            <div className="space-y-2">
              {matches.slice(0, 5).map((match) => {
                const isHome = match.homeId === teamId;
                const teamScore = isHome ? match.homeScore : match.awayScore;
                const opponentScore = isHome
                  ? match.awayScore
                  : match.homeScore;
                const result =
                  teamScore > opponentScore
                    ? "W"
                    : teamScore < opponentScore
                      ? "L"
                      : "D";

                return (
                  <a
                    key={match.id}
                    href={`/maestro/match/${match.id}`}
                    className="flex justify-between items-center p-3 bg-base-200 rounded hover:bg-base-300 transition-colors cursor-pointer"
                  >
                    <div>
                      <div className="font-semibold">
                        {isHome ? "vs" : "@"}{" "}
                        {getTeamName(isHome ? match.awayId : match.homeId)}
                      </div>
                      <div className="text-sm text-base-content/60">
                        {formatMatchDate(match.date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`badge ${
                          result === "W"
                            ? "badge-success"
                            : result === "L"
                              ? "badge-error"
                              : "badge-warning"
                        }`}
                      >
                        {result}
                      </div>
                      <div className="text-sm mt-1">
                        {teamScore} - {opponentScore}
                      </div>
                    </div>
                  </a>
                );
              })}
              {matches.length > 5 && (
                <div className="text-center pt-2">
                  <a href="/maestro/matches" className="btn btn-sm btn-outline">
                    View All Matches
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
