import { useState } from "preact/hooks";
import { Match } from "../types";
import { db } from "../utils/database";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMatchDate } from "../utils/helpers";

export function Matches() {
  const data = useLiveQuery(async () => {
    const [teams, matches] = await Promise.all([
      db.teams.orderBy("name").toArray(),
      db.matches.orderBy('date').reverse().toArray(),
    ]);
    return { teams, matches };
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Form state
  const [matchDate, setMatchDate] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");

  const handleAddMatch = async (e: Event) => {
    e.preventDefault();

    if (
      !matchDate ||
      !homeTeamId ||
      !awayTeamId ||
      homeScore === "" ||
      awayScore === ""
    ) {
      setError("Please fill in all fields");
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError("Home and away teams must be different");
      return;
    }

    const homeScoreNum = parseInt(homeScore);
    const awayScoreNum = parseInt(awayScore);

    if (
      isNaN(homeScoreNum) ||
      isNaN(awayScoreNum) ||
      homeScoreNum < 0 ||
      awayScoreNum < 0
    ) {
      setError("Scores must be valid numbers (0 or greater)");
      return;
    }

    // Check for duplicate matches (same teams and date)
    const existingMatch = data?.matches.find(match => 
      match.date === matchDate &&
      match.homeId === homeTeamId &&
      match.awayId === awayTeamId
    );

    if (existingMatch) {
      setError("A match between these teams on this date already exists");
      return;
    }

    try {
      const newMatch: Match = {
        id: crypto.randomUUID(),
        date: matchDate,
        homeId: homeTeamId,
        awayId: awayTeamId,
        homeScore: homeScoreNum,
        awayScore: awayScoreNum,
        createdAt: new Date(),
      };

      await db.matches.add(newMatch);

      // Reset form
      setMatchDate("");
      setHomeTeamId("");
      setAwayTeamId("");
      setHomeScore("");
      setAwayScore("");
      setShowAddForm(false);
      setError(null);
    } catch (err) {
      setError("Failed to add match");
      console.error("Error adding match:", err);
    }
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    setMatchDate(match.date);
    setHomeTeamId(match.homeId);
    setAwayTeamId(match.awayId);
    setHomeScore(match.homeScore.toString());
    setAwayScore(match.awayScore.toString());
    setError(null);
  };

  const handleUpdateMatch = async (e: Event) => {
    e.preventDefault();
    
    if (!editingMatch) return;
    
    if (!matchDate || !homeTeamId || !awayTeamId || homeScore === '' || awayScore === '') {
      setError('Please fill in all fields');
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError('Home and away teams must be different');
      return;
    }

    const homeScoreNum = parseInt(homeScore);
    const awayScoreNum = parseInt(awayScore);
    
    if (isNaN(homeScoreNum) || isNaN(awayScoreNum) || homeScoreNum < 0 || awayScoreNum < 0) {
      setError('Scores must be valid numbers (0 or greater)');
      return;
    }

    // Check for duplicate matches (same teams and date), excluding current match
    const existingMatch = data?.matches.find(match => 
      match.id !== editingMatch.id && // Exclude current match
      match.date === matchDate &&
      match.homeId === homeTeamId &&
      match.awayId === awayTeamId
    );

    if (existingMatch) {
      setError("A match between these teams on this date already exists");
      return;
    }

    try {
      const updatedMatch: Match = {
        ...editingMatch,
        date: matchDate,
        homeId: homeTeamId,
        awayId: awayTeamId,
        homeScore: homeScoreNum,
        awayScore: awayScoreNum,
      };

      await db.matches.put(updatedMatch);

      // Reset form
      setEditingMatch(null);
      setMatchDate("");
      setHomeTeamId("");
      setAwayTeamId("");
      setHomeScore("");
      setAwayScore("");
      setError(null);
    } catch (err) {
      setError("Failed to update match");
      console.error("Error updating match:", err);
    }
  };

  const handleCancelEdit = () => {
    setEditingMatch(null);
    setMatchDate("");
    setHomeTeamId("");
    setAwayTeamId("");
    setHomeScore("");
    setAwayScore("");
    setError(null);
  };

  const getTeamName = (teamId: string) => {
    const team = data?.teams.find((t) => t.id === teamId);
    return team ? team.name : "Unknown Team";
  };

  const formatMatchResult = (match: Match) => {
    const homeTeam = getTeamName(match.homeId);
    const awayTeam = getTeamName(match.awayId);
    return `${homeTeam} ${match.homeScore} - ${match.awayScore} ${awayTeam}`;
  };

  if (data == null) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Matches</h1>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddForm(true)}
          disabled={data.teams.length < 2}
        >
          Add Match
        </button>
      </div>

      {data.teams.length < 2 && (
        <div className="alert alert-warning">
          <span>
            You need at least 2 teams to record matches.{" "}
            <a href="/" className="link">
              Add teams first
            </a>
            .
          </span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {(showAddForm || editingMatch) && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title">{editingMatch ? 'Edit Match' : 'Add New Match'}</h2>
            <form onSubmit={editingMatch ? handleUpdateMatch : handleAddMatch} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Match Date</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={matchDate}
                  onInput={(e) =>
                    setMatchDate((e.target as HTMLInputElement).value)
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Home Team</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={homeTeamId}
                    onChange={(e) =>
                      setHomeTeamId((e.target as HTMLSelectElement).value)
                    }
                    required
                  >
                    <option value="">Select home team</option>
                    {data.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Away Team</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={awayTeamId}
                    onChange={(e) =>
                      setAwayTeamId((e.target as HTMLSelectElement).value)
                    }
                    required
                  >
                    <option value="">Select away team</option>
                    {data.teams.map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                        disabled={team.id === homeTeamId}
                      >
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Home Score</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered"
                    value={homeScore}
                    onInput={(e) =>
                      setHomeScore((e.target as HTMLInputElement).value)
                    }
                    placeholder="0"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Away Score</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input input-bordered"
                    value={awayScore}
                    onInput={(e) =>
                      setAwayScore((e.target as HTMLInputElement).value)
                    }
                    placeholder="0"
                    required
                  />
                </div>
              </div>

              <div className="card-actions justify-end">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={editingMatch ? handleCancelEdit : () => {
                    setShowAddForm(false);
                    setMatchDate("");
                    setHomeTeamId("");
                    setAwayTeamId("");
                    setHomeScore("");
                    setAwayScore("");
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingMatch ? 'Update Match' : 'Add Match'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {data.matches.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-base-content/60 text-lg">
            No matches recorded yet
          </div>
          <div className="text-base-content/40 text-sm mt-2">
            Add your first match to get started
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {data.matches.map((match) => (
            <div key={match.id} className="card bg-base-100 border border-base-300">
              <div className="card-body">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {formatMatchResult(match)}
                    </h3>
                    <p className="text-base-content/60 text-sm">
                      {formatMatchDate(match.date)}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div className="text-2xl font-bold">
                      {match.homeScore} - {match.awayScore}
                    </div>
                    <button 
                      className="btn btn-sm btn-outline"
                      onClick={() => handleEditMatch(match)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
