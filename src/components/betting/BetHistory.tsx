import { useState } from "preact/hooks";
import { Suspense } from "preact/compat";
import { useBetOverview } from "../../hooks/use-bet-overview";
import { calculateProfit } from "../../services/betService";
import { useDeleteBet, useUpdateBet } from "../../hooks/use-bets";
import { useAuth } from "../../contexts/AuthContext";
import { Matchup } from "../matchup";
import { Hide } from "../hide";

export default function BetHistory({
  query,
}: {
  query: ReturnType<typeof useBetOverview>;
}) {
  const [filter, setFilter] = useState<"all" | "win" | "lose" | "pending">(
    "all",
  );
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  const { data, isLoading, error } = query;
  const { isReadOnly } = useAuth();
  const deleteBet = useDeleteBet();
  const updateBet = useUpdateBet();

  const betsData = data?.overview?.bets || [];
  const teamsData = data?.teams || {};
  const matchesData = data?.matches || [];

  const filteredBets = betsData.filter((bet) => {
    if (filter === "all") return true;
    if (filter === "pending") return bet.result === "pending";
    return bet.result === filter;
  });

  const handleDelete = async (betId: number) => {
    if (confirm("Are you sure you want to delete this bet?")) {
      deleteBet.mutate(betId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "win":
        return <span className="badge badge-success">Win</span>;
      case "lose":
        return <span className="badge badge-error">Loss</span>;
      case "pending":
        return <span className="badge badge-ghost">Pending</span>;
      default:
        return <span className="badge badge-warning">{result}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center p-8">
        <div className="alert alert-error">
          <span>Error loading bet history: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bet History</h3>

        <div className="tabs tabs-boxed">
          {(["all", "pending", "win", "lose"] as const).map((filterOption) => (
            <button
              key={filterOption}
              className={`tab ${filter === filterOption ? "tab-active" : ""}`}
              onClick={() => setFilter(filterOption)}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filteredBets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No bets found for the selected filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-zebra w-full">
            <thead>
              <tr>
                <th>ID</th>
                <th>Match</th>
                <th>Bet</th>
                <th>Odds</th>
                <th>Wager</th>
                <th>Result</th>
                <th>P&L</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBets.reverse().map((bet) => (
                <tr key={bet.id}>
                  <td>{bet.id}</td>
                  <td>
                    <button
                      className="btn btn-link p-0"
                      onClick={() => setSelectedMatchId(bet.match_id)}
                    >
                      {bet.match_id}
                    </button>
                  </td>
                  <td>
                    <div className="text-sm">
                      {bet.name}
                      {bet.line !== 0 && (
                        <div className="text-xs text-gray-500">
                          Line: {bet.line}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{bet.odds > 0 ? `+${bet.odds}` : bet.odds}</td>
                  <td>{formatCurrency(bet.amount)}</td>
                  <td>{getResultBadge(bet.result)}</td>
                  <td>
                    {bet.result === "win" && (
                      <span className="text-success">
                        +{formatCurrency(calculateProfit(bet.amount, bet.odds))}
                      </span>
                    )}
                    {bet.result === "lose" && (
                      <span className="text-error">
                        -{formatCurrency(bet.amount)}
                      </span>
                    )}
                    {bet.result === "pending" && (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td>
                    <div className="flex justify-center">
                      {!isReadOnly ? (
                        <div className="dropdown dropdown-end">
                          <label tabIndex={0} className="btn btn-xs btn-ghost">
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
                            className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32"
                          >
                            {/* Set Result options - only for pending bets */}
                            {bet.result === "pending" && (
                              <>
                                <li className="menu-title">
                                  <span>Set Result</span>
                                </li>
                                <li>
                                  <a
                                    onClick={() =>
                                      updateBet.mutate({
                                        id: bet.id,
                                        result: "win",
                                      })
                                    }
                                  >
                                    Win
                                  </a>
                                </li>
                                <li>
                                  <a
                                    onClick={() =>
                                      updateBet.mutate({
                                        id: bet.id,
                                        result: "lose",
                                      })
                                    }
                                  >
                                    Loss
                                  </a>
                                </li>
                                <li>
                                  <a
                                    onClick={() =>
                                      updateBet.mutate({
                                        id: bet.id,
                                        result: "push",
                                      })
                                    }
                                  >
                                    Push
                                  </a>
                                </li>
                              </>
                            )}
                            {/* Always available actions */}
                            <li>
                              <a
                                onClick={() => handleDelete(bet.id)}
                                className="text-error"
                              >
                                Delete
                              </a>
                            </li>
                          </ul>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Hide when={selectedMatchId == null}>
        {/*defer evaluation because a null selectedMatchup will cause type errors*/}
        {() => (
          <Suspense fallback={<div>Loading...</div>}>
            <Matchup
              matchId={selectedMatchId!}
              onClose={() => {
                setSelectedMatchId(null);
              }}
            />
          </Suspense>
        )}
      </Hide>
    </div>
  );
}
