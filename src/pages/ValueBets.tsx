import { useState } from "preact/hooks";
import { Suspense } from "preact/compat";
import { formatMatchDate } from "../utils/helpers";
import { useJuice, JuiceFixture } from "../hooks/use-juice";
import { Hide } from "../components/hide";
import { Matchup } from "../components/matchup";
import BetForm, { BetFormProps } from "../components/betting/BetForm";
import { useAuth } from "../contexts/AuthContext";

export function ValueBets() {
  // Date navigation state
  const [selectedDate, setSelectedDate] = useState<string>(
    // Default to today's date in YYYY-MM-DD format
    new Date().toISOString().split("T")[0] || "",
  );

  const { data: valueBets, isLoading, error } = useJuice(selectedDate);
  const { isReadOnly } = useAuth();
  const [comparisonMatch, setComparisonMatch] = useState<{
    homeTeamId: number;
    awayTeamId: number;
    matchId: number;
    valueBets?: JuiceFixture;
  } | null>(null);

  // Date navigation functions
  const navigateDate = (direction: "prev" | "next") => {
    const currentDate = new Date(selectedDate + "T00:00:00");
    const newDate = new Date(currentDate);

    if (direction === "prev") {
      newDate.setDate(currentDate.getDate() - 1);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }

    setSelectedDate(newDate.toISOString().split("T")[0]!);
  };

  const formatDisplayDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00"); // Ensure consistent timezone
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Bet form state
  const [showBetForm, setShowBetForm] = useState(false);
  const [selectedMatchForBet, setSelectedMatchForBet] = useState<number | null>(
    null,
  );
  const [prefilledBet, setPrefilledBet] = useState<
    BetFormProps["initialData"] | null
  >(null);

  const handleRecordBet = (
    matchId: number,
    type_id: number,
    description: string,
    odds: number,
  ) => {
    setSelectedMatchForBet(matchId);
    setPrefilledBet({ description, odds, type_id });
    setShowBetForm(true);
  };

  const handleBetCreated = () => {
    setShowBetForm(false);
    setSelectedMatchForBet(null);
    setPrefilledBet(null);
  };

  const handleCancelBet = () => {
    setShowBetForm(false);
    setSelectedMatchForBet(null);
    setPrefilledBet(null);
  };

  const formatOdds = (odd: number) => {
    if (odd > 0) {
      return `+${odd}`;
    }
    return odd.toString();
  };

  const formatMatchup = (fixture: any) => {
    return `${fixture.home.name} vs ${fixture.away.name}`;
  };

  const formatFixtureTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // Force 24-hour format
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Value Bets</h1>
        <div className="flex items-center gap-4">
          {/* Date Display */}
          <div className="text-lg font-medium text-base-content/80">
            {formatDisplayDate(selectedDate)}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm btn-outline"
              onClick={() => navigateDate("prev")}
              aria-label="Previous day"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <button
              className="btn btn-sm btn-outline"
              onClick={() => navigateDate("next")}
              aria-label="Next day"
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Today Button */}
            <button
              className="btn btn-sm btn-primary"
              onClick={() =>
                setSelectedDate(new Date().toISOString().split("T")[0] || "")
              }
            >
              Today
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>
            Failed to load value bets:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </span>
        </div>
      )}

      <Hide when={!isLoading}>
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
          <div className="mt-4 text-base-content/60">Loading value bets...</div>
        </div>
      </Hide>

      <Hide when={isLoading}>
        {!valueBets || valueBets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-base-content/60 text-lg">
              No value bets available right now
            </div>
            <div className="text-base-content/40 text-sm mt-2">
              Check back later for new opportunities
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {valueBets.map((bet, index) => (
              <div
                key={bet.fixture.id}
                className="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
              >
                <div className="card-body">
                  <div className="flex flex-col gap-4">
                    {/* Match Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3
                          className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.preventDefault();
                            setComparisonMatch({
                              homeTeamId: bet.fixture.home.id,
                              awayTeamId: bet.fixture.away.id,
                              matchId: bet.fixture.id,
                              valueBets: bet,
                            });
                          }}
                        >
                          {formatMatchup(bet.fixture)}
                        </h3>
                        <p className="text-base-content/60 text-sm">
                          {bet.fixture.league_name} •{" "}
                          {formatFixtureTime(bet.fixture.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <img
                          src={bet.fixture.home.logo}
                          alt={bet.fixture.home.name}
                          className="w-6 h-6"
                        />
                        <span className="text-sm">vs</span>
                        <img
                          src={bet.fixture.away.logo}
                          alt={bet.fixture.away.name}
                          className="w-6 h-6"
                        />
                      </div>
                    </div>

                    {/* Betting Markets */}
                    <div className="space-y-3">
                      {bet.stats.map((betType) => (
                        <div
                          key={betType.id}
                          className="bg-base-200 p-3 rounded-lg"
                        >
                          <h4 className="font-medium text-sm mb-2">
                            {betType.name}
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {betType.values.map((value, valueIndex) => (
                              <div
                                key={`${betType.id}-${valueIndex}`}
                                aria-disabled={isReadOnly}
                                className="badge badge-lg badge-primary cursor-pointer hover:badge-primary-focus transition-colors aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                                onClick={
                                  isReadOnly
                                    ? undefined
                                    : () => {
                                        handleRecordBet(
                                          bet.fixture.id,
                                          betType.id,
                                          `${betType.name} - ${value.name}`,
                                          value.odd,
                                        );
                                      }
                                }
                              >
                                {value.name}: {formatOdds(value.odd)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Hide>

      <Hide when={!showBetForm && selectedMatchForBet == null}>
        <BetForm
          matchId={selectedMatchForBet!}
          onBetCreated={handleBetCreated}
          onCancel={handleCancelBet}
          initialData={prefilledBet || undefined}
        />
      </Hide>

      <Hide when={comparisonMatch == null}>
        {/*defer evaluation because a null comparisonMatch will cause type errors*/}
        {() => (
          <Suspense fallback={<div>Loading...</div>}>
            <Matchup
              matchId={comparisonMatch!.matchId}
              valueBets={comparisonMatch!.valueBets}
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
