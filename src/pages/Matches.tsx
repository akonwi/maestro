import { useState } from "preact/hooks";
import { Match } from "../types";
import { db } from "../utils/database";
import { useLiveQuery } from "dexie-react-hooks";
import { formatMatchDate } from "../utils/helpers";
import BetForm from "../components/betting/BetForm";
import BetList from "../components/betting/BetList";
import { TeamComparison } from "../components/TeamComparison";
import { useQuickImport } from "../hooks/useQuickImport";
import { Link } from "react-router";

export function Matches() {
  const data = useLiveQuery(async () => {
    const [teams, allMatches] = await Promise.all([
      db.teams.orderBy("name").toArray(),
      db.matches.orderBy("date").toArray(),
    ]);

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Separate completed and upcoming matches
    const completedMatches = allMatches
      .filter((match) => match.homeScore !== null && match.awayScore !== null)
      .reverse(); // Most recent first

    const upcomingMatches = allMatches
      .filter((match) => {
        // Include matches with null scores or future dates
        const isUpcoming = match.homeScore === null && match.awayScore === null;
        // const isFuture = match.date >= today;
        return isUpcoming; // || isFuture;
      })
      .sort((a, b) => a.date.localeCompare(b.date)); // Earliest first

    return { teams, completedMatches, upcomingMatches };
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [showBetForm, setShowBetForm] = useState(false);
  const [selectedMatchForBet, setSelectedMatchForBet] = useState<string | null>(
    null,
  );
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"played" | "pending">("pending");
  const [showTeamComparison, setShowTeamComparison] = useState(false);
  const [comparisonMatch, setComparisonMatch] = useState<{
    homeTeamId: string;
    awayTeamId: string;
  } | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    errors?: string[];
  } | null>(null);

  const { isImporting, progress, canQuickImport, quickImport } =
    useQuickImport();

  // Form state
  const [matchDate, setMatchDate] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [isUpcomingMatch, setIsUpcomingMatch] = useState(false);

  const handleAddMatch = async (e: Event) => {
    e.preventDefault();

    if (
      !matchDate ||
      !homeTeamId ||
      !awayTeamId ||
      (!isUpcomingMatch && (homeScore === "" || awayScore === ""))
    ) {
      setError("Please fill in all required fields");
      return;
    }

    if (homeTeamId === awayTeamId) {
      setError("Home and away teams must be different");
      return;
    }

    let homeScoreNum: number | null = null;
    let awayScoreNum: number | null = null;

    if (!isUpcomingMatch) {
      homeScoreNum = parseInt(homeScore);
      awayScoreNum = parseInt(awayScore);

      if (
        isNaN(homeScoreNum) ||
        isNaN(awayScoreNum) ||
        homeScoreNum < 0 ||
        awayScoreNum < 0
      ) {
        setError("Scores must be valid numbers (0 or greater)");
        return;
      }
    }

    // Check for duplicate matches (same teams and date)
    const allMatches = [
      ...(data?.completedMatches || []),
      ...(data?.upcomingMatches || []),
    ];
    const existingMatch = allMatches.find(
      (match) =>
        match.date === matchDate &&
        match.homeId === homeTeamId &&
        match.awayId === awayTeamId,
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
        status: isUpcomingMatch ? "scheduled" : "completed",
      };

      await db.matches.add(newMatch);

      // Reset form
      setMatchDate("");
      setHomeTeamId("");
      setAwayTeamId("");
      setHomeScore("");
      setAwayScore("");
      setIsUpcomingMatch(false);
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

    // Check for duplicate matches (same teams and date), excluding current match
    const existingMatch = data?.matches.find(
      (match) =>
        match.id !== editingMatch.id && // Exclude current match
        match.date === matchDate &&
        match.homeId === homeTeamId &&
        match.awayId === awayTeamId,
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

  const handleRecordBet = (matchId: string) => {
    setSelectedMatchForBet(matchId);
    setShowBetForm(true);
  };

  const handleBetCreated = () => {
    setShowBetForm(false);
    setSelectedMatchForBet(null);
  };

  const handleCancelBet = () => {
    setShowBetForm(false);
    setSelectedMatchForBet(null);
  };

  const handleRefreshClick = async () => {
    setImportResult(null);
    const result = await quickImport();
    setImportResult(result);
  };

  const handleCloseImportResult = () => {
    setImportResult(null);
  };

  const handleShowTeamComparison = (homeTeamId: string, awayTeamId: string) => {
    setComparisonMatch({ homeTeamId, awayTeamId });
    setShowTeamComparison(true);
  };

  const handleCloseTeamComparison = () => {
    setShowTeamComparison(false);
    setComparisonMatch(null);
  };

  const toggleMatchExpansion = (matchId: string) => {
    setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
  };

  const handleDeleteMatch = async (match: Match) => {
    if (
      confirm(
        `Are you sure you want to delete the match "${formatMatchResult(match)}"? This action cannot be undone.`,
      )
    ) {
      try {
        await db.matches.delete(match.id);
      } catch (error) {
        console.error("Failed to delete match:", error);
        alert("Failed to delete match");
      }
    }
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
        <div className="flex gap-2">
          <button
            className="btn btn-secondary"
            onClick={handleRefreshClick}
            disabled={isImporting || !canQuickImport().canImport}
          >
            {isImporting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Importing...
              </>
            ) : (
              "Refresh"
            )}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddForm(true)}
            disabled={data.teams.length < 2}
          >
            Add Match
          </button>
        </div>
      </div>

      {data.teams.length < 2 && (
        <div className="alert alert-warning">
          <span>
            You need at least 2 teams to record matches.{" "}
            <Link to="/maestro/">Add teams first</Link>.
          </span>
        </div>
      )}

      {progress && (
        <div className="alert alert-info">
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium">{progress.current}</div>
            {progress.total > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <progress
                  className="progress progress-primary w-full"
                  value={progress.completed}
                  max={progress.total}
                ></progress>
                <span className="text-xs text-base-content/60">
                  {progress.completed}/{progress.total}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {importResult && (
        <div
          className={`alert ${importResult.success ? "alert-success" : "alert-error"}`}
        >
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
              d={
                importResult.success
                  ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              }
            />
          </svg>
          <div className="flex-1">
            <div className="font-medium">{importResult.message}</div>
            {importResult.errors && importResult.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm">
                  {importResult.errors.length} error
                  {importResult.errors.length !== 1 ? "s" : ""}
                </summary>
                <ul className="list-disc list-inside text-xs mt-1 ml-4">
                  {importResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleCloseImportResult}
          >
            ×
          </button>
        </div>
      )}

      {!canQuickImport().canImport && (
        <div className="alert alert-info">
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
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="font-bold">Import Not Available</h3>
            <div className="text-sm">
              {canQuickImport().reason} -{" "}
              <Link to="/settings" className="link">
                Configure in Settings
              </Link>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs tabs-bordered">
        <button
          className={`tab tab-lg ${activeTab === "pending" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Upcoming
        </button>
        <button
          className={`tab tab-lg ${activeTab === "played" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("played")}
        >
          Past
        </button>
      </div>

      {(showAddForm || editingMatch) && (
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body">
            <h2 className="card-title">
              {editingMatch ? "Edit Match" : "Add New Match"}
            </h2>
            <form
              onSubmit={editingMatch ? handleUpdateMatch : handleAddMatch}
              className="space-y-4"
            >
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
                  onClick={
                    editingMatch
                      ? handleCancelEdit
                      : () => {
                          setShowAddForm(false);
                          setMatchDate("");
                          setHomeTeamId("");
                          setAwayTeamId("");
                          setHomeScore("");
                          setAwayScore("");
                          setError(null);
                        }
                  }
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingMatch ? "Update Match" : "Add Match"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "played" && (
        <>
          {data.completedMatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-base-content/60 text-lg">
                No completed matches yet
              </div>
              <div className="text-base-content/40 text-sm mt-2">
                Add your first match to get started
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {data.completedMatches.map((match) => (
                <div
                  key={match.id}
                  className="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
                >
                  <div className="card-body">
                    <div className="flex justify-between items-center">
                      <div
                        className="cursor-pointer flex-1"
                        onClick={() =>
                          (window.location.href = `/match/${match.id}`)
                        }
                      >
                        <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                          {formatMatchResult(match)}
                        </h3>
                        <p className="text-base-content/60 text-sm">
                          {formatMatchDate(match.date)}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div className="text-2xl font-bold">
                          {match.homeScore} - {match.awayScore}
                        </div>

                        {/* Desktop buttons - hidden on small screens */}
                        <div className="hidden sm:flex items-center gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleRecordBet(match.id)}
                          >
                            Record Bet
                          </button>
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleEditMatch(match)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => toggleMatchExpansion(match.id)}
                          >
                            {expandedMatchId === match.id ? "−" : "+"}
                          </button>
                          <button
                            className="btn btn-sm btn-error btn-outline"
                            onClick={() => handleDeleteMatch(match)}
                          >
                            Delete
                          </button>
                        </div>

                        {/* Mobile dropdown - shown only on small screens */}
                        <div className="dropdown dropdown-end sm:hidden">
                          <label tabIndex={0} className="btn btn-sm btn-ghost">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z"
                              />
                            </svg>
                          </label>
                          <ul
                            tabIndex={0}
                            className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44 z-10"
                          >
                            <li>
                              <a
                                onClick={() => handleRecordBet(match.id)}
                                className="text-primary"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                  />
                                </svg>
                                Record Bet
                              </a>
                            </li>
                            <li>
                              <a
                                onClick={() => handleEditMatch(match)}
                                className="text-base-content"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit Match
                              </a>
                            </li>
                            <li>
                              <a
                                onClick={() => toggleMatchExpansion(match.id)}
                                className="text-base-content"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d={
                                      expandedMatchId === match.id
                                        ? "M19 9l-7 7-7-7"
                                        : "M9 5l7 7-7 7"
                                    }
                                  />
                                </svg>
                                {expandedMatchId === match.id
                                  ? "Hide Bets"
                                  : "Show Bets"}
                              </a>
                            </li>
                            <li>
                              <a
                                onClick={() => handleDeleteMatch(match)}
                                className="text-error"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                Delete Match
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    {expandedMatchId === match.id && (
                      <div className="mt-4 pt-4 border-t border-base-300">
                        <BetList matchId={match.id} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === "pending" && (
        <>
          {data.upcomingMatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-base-content/60 text-lg">
                No upcoming matches scheduled
              </div>
              <div className="text-base-content/40 text-sm mt-2">
                Check the import settings to fetch upcoming fixtures
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {data.upcomingMatches.map((match) => (
                <div
                  key={match.id}
                  className="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
                  data-team-match-id={match.id}
                >
                  <div className="card-body">
                    <div className="flex justify-between items-center">
                      <div
                        className="cursor-pointer flex-1"
                        onClick={() =>
                          handleShowTeamComparison(match.homeId, match.awayId)
                        }
                      >
                        <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                          {getTeamName(match.homeId)} vs{" "}
                          {getTeamName(match.awayId)}
                        </h3>
                        <p className="text-base-content/60 text-sm">
                          {formatMatchDate(match.date)}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        {/* Desktop buttons - hidden on small screens */}
                        <div className="hidden sm:flex items-center gap-2">
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleRecordBet(match.id)}
                          >
                            Record Bet
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => toggleMatchExpansion(match.id)}
                          >
                            {expandedMatchId === match.id ? "−" : "+"}
                          </button>
                        </div>

                        {/* Mobile dropdown - shown only on small screens */}
                        <div className="dropdown dropdown-end sm:hidden">
                          <label tabIndex={0} className="btn btn-sm btn-ghost">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z"
                              />
                            </svg>
                          </label>
                          <ul
                            tabIndex={0}
                            className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44 z-10"
                          >
                            <li>
                              <a
                                onClick={() => handleRecordBet(match.id)}
                                className="text-primary"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                  />
                                </svg>
                                Record Bet
                              </a>
                            </li>
                            <li>
                              <a
                                onClick={() => toggleMatchExpansion(match.id)}
                                className="text-base-content"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d={
                                      expandedMatchId === match.id
                                        ? "M19 9l-7 7-7-7"
                                        : "M9 5l7 7-7 7"
                                    }
                                  />
                                </svg>
                                {expandedMatchId === match.id
                                  ? "Hide Bets"
                                  : "Show Bets"}
                              </a>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    {expandedMatchId === match.id && (
                      <div className="mt-4 pt-4 border-t border-base-300">
                        <BetList matchId={match.id} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showBetForm && selectedMatchForBet && (
        <BetForm
          matchId={selectedMatchForBet}
          onBetCreated={handleBetCreated}
          onCancel={handleCancelBet}
        />
      )}

      {showTeamComparison && comparisonMatch && (
        <TeamComparison
          homeTeamId={comparisonMatch.homeTeamId}
          awayTeamId={comparisonMatch.awayTeamId}
          onClose={handleCloseTeamComparison}
        />
      )}
    </div>
  );
}
