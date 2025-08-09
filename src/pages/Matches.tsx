import { useState, useEffect } from "preact/hooks";
import { formatMatchDate, partition } from "../utils/helpers";
import BetForm from "../components/betting/BetForm";
import BetList from "../components/betting/BetList";
import { TeamComparison } from "../components/TeamComparison";
import { useLeagues } from "../hooks/use-leagues";

interface Match {
  id: string;
  date: string;
  timestamp: number;
  home_team_id: number;
  away_team_id: number;
  home_goals: number;
  away_goals: number;
  league_id: number;
  status: "NS" | "FT";
  winner_id: number | null;
}

interface Team {
  league_id: number;
  id: number;
  name: string;
  code: string | null;
}

export function Matches() {
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [teams, setTeams] = useState<Map<number, Team>>(new Map());
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const { data: leaguesData } = useLeagues();

  // Fetch league data when selectedLeagueId changes
  useEffect(() => {
    const fetchLeagueData = async () => {
      if (!selectedLeagueId) {
        return;
      }

      setLoading(true);
      setApiError(null);

      try {
        // Fetch league-specific data from API
        const response = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/leagues/${selectedLeagueId}/matches`,
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const { teams, matches } = (await response.json()) as {
          teams: Team[];
          matches: Match[];
        };
        setMatches(matches);
        setTeams(new Map(teams.map((t) => [t.id, t])));
      } catch (error) {
        console.error("Error fetching league data:", error);
        setApiError(
          error instanceof Error
            ? error.message
            : "Failed to fetch league data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, [selectedLeagueId]);

  const [showBetForm, setShowBetForm] = useState(false);
  const [selectedMatchForBet, setSelectedMatchForBet] = useState<string | null>(
    null,
  );
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"played" | "pending">("pending");
  const [showTeamComparison, setShowTeamComparison] = useState(false);
  const [comparisonMatch, setComparisonMatch] = useState<{
    homeTeamId: number;
    awayTeamId: number;
  } | null>(null);

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

  const handleShowTeamComparison = (homeTeamId: number, awayTeamId: number) => {
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

  const getTeamName = (id: number) => teams.get(id)?.name ?? "Unknown";

  const formatMatchResult = (match: Match) => {
    const homeTeam = getTeamName(match.home_team_id);
    const awayTeam = getTeamName(match.away_team_id);
    return `${homeTeam} ${match.home_goals} - ${match.away_goals} ${awayTeam}`;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const { left: completed, right: future } = partition(matches, (m) =>
    m.status == "FT" ? "left" : "right",
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Matches</h1>
      </div>

      {!selectedLeagueId && (
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
          <span>Please select a league to view matches.</span>
        </div>
      )}

      {apiError && (
        <div className="alert alert-error">
          <span>Failed to load league data: {apiError}</span>
        </div>
      )}

      {/* League Selector */}
      <div className="form-control max-w-xs">
        <label className="label">
          <span className="label-text font-semibold">League</span>
        </label>
        <select
          className="select select-bordered"
          value={selectedLeagueId}
          onChange={(e) =>
            setSelectedLeagueId((e.target as HTMLSelectElement).value)
          }
        >
          <option value="">Select a league</option>
          {leaguesData?.leagues.map((league) => (
            <option key={league.id} value={league.id.toString()}>
              {league.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tab Navigation */}
      {selectedLeagueId && (
        <>
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

          {/* Tab Content */}
          {activeTab === "played" && (
            <>
              {completed.length === 0 ? (
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
                  {completed.map((match) => (
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
                              {match.home_goals} - {match.away_goals}
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
                                className="btn btn-sm btn-ghost"
                                onClick={() => toggleMatchExpansion(match.id)}
                              >
                                {expandedMatchId === match.id ? "−" : "+"}
                              </button>
                            </div>

                            {/* Mobile dropdown - shown only on small screens */}
                            <div className="dropdown dropdown-end sm:hidden">
                              <label
                                tabIndex={0}
                                className="btn btn-sm btn-ghost"
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
                                    onClick={() =>
                                      toggleMatchExpansion(match.id)
                                    }
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

          {activeTab === "pending" && (
            <>
              {future.length === 0 ? (
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
                  {future.reverse().map((match) => (
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
                              handleShowTeamComparison(
                                match.home_team_id,
                                match.away_team_id,
                              )
                            }
                          >
                            <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                              {getTeamName(match.home_team_id)} vs{" "}
                              {getTeamName(match.away_team_id)}
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
                              <label
                                tabIndex={0}
                                className="btn btn-sm btn-ghost"
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
                                    onClick={() =>
                                      toggleMatchExpansion(match.id)
                                    }
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
        </>
      )}

      {showBetForm && selectedMatchForBet && (
        <BetForm
          matchId={selectedMatchForBet}
          onBetCreated={handleBetCreated}
          onCancel={handleCancelBet}
        />
      )}

      {
        showTeamComparison && comparisonMatch && "Todo"
        // <TeamComparison
        //   homeTeamId={comparisonMatch.homeTeamId}
        //   awayTeamId={comparisonMatch.awayTeamId}
        //   onClose={handleCloseTeamComparison}
        // />
      }
    </div>
  );
}
