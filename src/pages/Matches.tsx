import { useState, useEffect } from "preact/hooks";
import { Suspense } from "preact/compat";
import { formatMatchDate, isEmpty, partition } from "../utils/helpers";
import BetForm from "../components/betting/BetForm";
import BetList from "../components/betting/BetList";
import { Matchup } from "../components/matchup";
import { useLeagues } from "../hooks/use-leagues";
import { useAuth } from "../contexts/AuthContext";
import { useMatches } from "../hooks/use-matches";
import { Match } from "../types";
import { Hide } from "../components/hide";
import { Fragment } from "preact/jsx-runtime";

export function Matches() {
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const {
    data: matchData,
    isLoading: isLoadingMatches,
    error: apiError,
  } = useMatches(selectedLeagueId);
  const { data: leaguesData } = useLeagues();
  const { isReadOnly } = useAuth();

  const matches = matchData?.matches ?? [];

  useEffect(() => {
    // once leagues are loaded, select the first one
    if (!isEmpty(leaguesData?.leagues)) {
      setSelectedLeagueId(leaguesData?.leagues?.[0]?.id ?? null);
    }
  }, [leaguesData?.leagues?.length]);

  const [showBetForm, setShowBetForm] = useState(false);
  const [selectedMatchForBet, setSelectedMatchForBet] = useState<number | null>(
    null,
  );
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);

  // Fetch odds for selected match (only when bet form is open)
  const [activeTab, setActiveTab] = useState<"played" | "pending">("pending");
  const [comparisonMatch, setComparisonMatch] = useState<{
    homeTeamId: number;
    awayTeamId: number;
    matchId: number;
  } | null>(null);

  const handleRecordBet = (matchId: number) => {
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

  const toggleMatchExpansion = (matchId: number) => {
    setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
  };

  const { left: completed, right: future } = partition(matches, (m) =>
    m.status == "FT" ? "left" : "right",
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Matches</h1>
      </div>

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
          value={selectedLeagueId ?? undefined}
          onChange={(e) =>
            setSelectedLeagueId(Number((e.target as HTMLSelectElement).value))
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
      <Fragment>
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

        <Hide when={!isLoadingMatches && matches.length > 0}>
          <div className="text-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        </Hide>
        <Hide when={isLoadingMatches}>
          <Hide when={activeTab !== "played"}>
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
                        <div className="cursor-pointer flex-1">
                          <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                            {((match: Match) => {
                              return `${match.home.name} ${match.home_goals} - ${match.away_goals} ${match.away.name}`;
                            })(match)}
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
                              className={`btn btn-sm ${isReadOnly ? "btn-disabled" : "btn-primary"}`}
                              disabled={isReadOnly}
                              onClick={() => handleRecordBet(match.id)}
                            ></button>
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
                                  onClick={() =>
                                    !isReadOnly && handleRecordBet(match.id)
                                  }
                                  className={
                                    isReadOnly
                                      ? "text-base-content/40"
                                      : "text-primary"
                                  }
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
          </Hide>

          <Hide when={activeTab != "pending"}>
            {future.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-base-content/60 text-lg">
                  No upcoming matches scheduled
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
                          onClick={(e) => {
                            e.preventDefault();
                            setComparisonMatch({
                              homeTeamId: match.home.id,
                              awayTeamId: match.away.id,
                              matchId: match.id,
                            });
                          }}
                        >
                          <h3 className="text-lg font-semibold hover:text-primary transition-colors">
                            {match.home.name} vs {match.away.name}
                          </h3>
                          <p className="text-base-content/60 text-sm">
                            {formatMatchDate(match.date)}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          {/* Desktop buttons - hidden on small screens */}
                          <div className="hidden sm:flex items-center gap-2">
                            <button
                              className={`btn btn-sm ${isReadOnly ? "btn-disabled" : "btn-primary"}`}
                              disabled={isReadOnly}
                              onClick={() => handleRecordBet(match.id)}
                            ></button>
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
                                  onClick={() =>
                                    !isReadOnly && handleRecordBet(match.id)
                                  }
                                  className={
                                    isReadOnly
                                      ? "text-base-content/40"
                                      : "text-primary"
                                  }
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
          </Hide>
        </Hide>
      </Fragment>

      <Hide when={!showBetForm && selectedMatchForBet == null}>
        <BetForm
          matchId={selectedMatchForBet!}
          onBetCreated={handleBetCreated}
          onCancel={handleCancelBet}
        />
      </Hide>

      <Hide when={comparisonMatch == null}>
        {/*defer evaluation because a null comparisonMatch will cause type errors*/}
        {() => (
          <Suspense fallback={<div>Loading...</div>}>
            <Matchup
              matchId={comparisonMatch!.matchId}
              onClose={() => {
                setComparisonMatch(null);
              }}
            />
          </Suspense>
        )}
      </Hide>
    </div>
  );
}
