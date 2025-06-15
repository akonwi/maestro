import { useState, useEffect } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../utils/database";
import { Match } from "../types";
import { formatMatchDate } from "../utils/helpers";
import BetForm from "../components/betting/BetForm";
import BetList from "../components/betting/BetList";
import { useParams } from "react-router";

export function MatchDetail() {
  const params = useParams();
  const matchId = params.matchId!;
  const [showBetForm, setShowBetForm] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [matchDate, setMatchDate] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [error, setError] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    const [match, teams] = await Promise.all([
      db.matches.get(matchId),
      db.teams.orderBy("name").toArray(),
    ]);

    if (!match) return null;

    const [homeTeam, awayTeam] = await Promise.all([
      db.teams.get(match.homeId),
      db.teams.get(match.awayId),
    ]);

    return { match, homeTeam, awayTeam, teams };
  }, [matchId]);

  useEffect(() => {
    if (editingMatch) {
      setMatchDate(editingMatch.date);
      setHomeTeamId(editingMatch.homeId);
      setAwayTeamId(editingMatch.awayId);
      setHomeScore(editingMatch.homeScore.toString());
      setAwayScore(editingMatch.awayScore.toString());
    }
  }, [editingMatch]);

  const handleEditMatch = async (e: Event) => {
    e.preventDefault();

    if (!editingMatch || !data?.teams) return;

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
      setEditingMatch(null);
      setError(null);
    } catch (err) {
      setError("Failed to update match");
      console.error("Error updating match:", err);
    }
  };

  const handleCancelEdit = () => {
    setEditingMatch(null);
    setError(null);
  };

  const handleBetCreated = () => {
    setShowBetForm(false);
  };

  const handleCancelBet = () => {
    setShowBetForm(false);
  };

  if (!data) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (!data.match || !data.homeTeam || !data.awayTeam) {
    return (
      <div className="alert alert-error">
        <span>Match not found</span>
      </div>
    );
  }

  const { match, homeTeam, awayTeam, teams } = data;

  return (
    <div className="space-y-6">
      <div className="breadcrumbs text-sm">
        <ul>
          <li>
            <a href="/matches">Matches</a>
          </li>
          <li>
            {homeTeam.name} vs {awayTeam.name}
          </li>
        </ul>
      </div>

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          {editingMatch ? (
            <form onSubmit={handleEditMatch} className="space-y-4">
              <h2 className="card-title">Edit Match</h2>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Date</span>
                  </label>
                  <input
                    type="date"
                    value={matchDate}
                    onInput={(e) =>
                      setMatchDate((e.target as HTMLInputElement).value)
                    }
                    className="input input-bordered"
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Home Team</span>
                  </label>
                  <select
                    value={homeTeamId}
                    onChange={(e) =>
                      setHomeTeamId((e.target as HTMLSelectElement).value)
                    }
                    className="select select-bordered"
                    required
                  >
                    <option value="">Select home team</option>
                    {teams.map((team) => (
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
                    value={awayTeamId}
                    onChange={(e) =>
                      setAwayTeamId((e.target as HTMLSelectElement).value)
                    }
                    className="select select-bordered"
                    required
                  >
                    <option value="">Select away team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Home Score</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={homeScore}
                      onInput={(e) =>
                        setHomeScore((e.target as HTMLInputElement).value)
                      }
                      className="input input-bordered"
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
                      value={awayScore}
                      onInput={(e) =>
                        setAwayScore((e.target as HTMLInputElement).value)
                      }
                      className="input input-bordered"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Match
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h1 className="text-3xl font-bold">
                    {homeTeam.name} vs {awayTeam.name}
                  </h1>
                  <p className="text-base-content/60 text-lg">
                    {formatMatchDate(match.date)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-6xl font-bold mb-2">
                    {match.homeScore} - {match.awayScore}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowBetForm(true)}
                    >
                      Record Bet
                    </button>
                    <button
                      className="btn btn-outline"
                      onClick={() => setEditingMatch(match)}
                    >
                      Edit Match
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold">Match Details</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Home Team:</span>
                      <span>{homeTeam.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Away Team:</span>
                      <span>{awayTeam.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Date:</span>
                      <span>{formatMatchDate(match.date)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Final Score:</span>
                      <span className="font-bold">
                        {match.homeScore} - {match.awayScore}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Result:</span>
                      <span className="font-bold">
                        {match.homeScore > match.awayScore
                          ? `${homeTeam.name} Win`
                          : match.awayScore > match.homeScore
                            ? `${awayTeam.name} Win`
                            : "Draw"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <BetList matchId={match.id} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showBetForm && (
        <BetForm
          matchId={match.id}
          onBetCreated={handleBetCreated}
          onCancel={handleCancelBet}
        />
      )}
    </div>
  );
}
