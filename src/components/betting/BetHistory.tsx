import { useState } from "preact/hooks";
import { useBetOverview, type Team } from "../../hooks/use-bet-overview";
import { calculateProfit } from "../../services/betService";

export default function BetHistory() {
  const [filter, setFilter] = useState<"all" | "win" | "lose" | "pending">(
    "all",
  );

  const { data, loading, error } = useBetOverview();

  const betsData = data?.overview?.bets || [];
  const teamsData = data?.teams || {};

  const filteredBets = betsData.filter((bet) => {
    if (filter === "all") return true;
    if (filter === "pending") return bet.result === "pending";
    return bet.result === filter;
  });

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

  if (loading) {
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
              {filteredBets.map((bet) => (
                <tr key={bet.id}>
                  <td>{bet.id}</td>
                  <td>
                    <div className="text-sm">{bet.match_id}</div>
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
                    <span className="text-gray-400">-</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
