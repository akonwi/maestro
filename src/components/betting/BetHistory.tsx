import { useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Bet,
  calculatePayout,
  calculateProfit,
  updateBet,
} from "../../services/betService";
import { db } from "../../utils/database";
import { Team, Match } from "../../types";

interface BetHistoryProps {
  limit?: number;
}

interface BetWithMatchData extends Bet {
  match?: Match;
  homeTeam?: Team;
  awayTeam?: Team;
}

export default function BetHistory({ limit }: BetHistoryProps) {
  const [filter, setFilter] = useState<
    "all" | "win" | "loss" | "push" | "pending"
  >("all");

  const betsWithMatchData = useLiveQuery(async () => {
    const allBets = await db.bets.orderBy("createdAt").reverse().toArray();

    const betsWithMatchData = await Promise.all(
      allBets.map(async (bet) => {
        try {
          const match = await db.matches.get(bet.matchId);
          if (match) {
            const [homeTeam, awayTeam] = await Promise.all([
              db.teams.get(match.homeId),
              db.teams.get(match.awayId),
            ]);
            return { ...bet, match, homeTeam, awayTeam };
          }
          return bet;
        } catch (error) {
          console.error("Failed to load match data for bet:", bet.id, error);
          return bet;
        }
      }),
    );

    return limit ? betsWithMatchData.slice(0, limit) : betsWithMatchData;
  });

  const filteredBets = betsWithMatchData
    ? betsWithMatchData.filter((bet) => {
        if (filter === "all") return true;
        if (filter === "pending") return !bet.result;
        return bet.result === filter;
      })
    : [];

  const handleResultUpdate = async (
    betId: string,
    result: "win" | "loss" | "push",
  ) => {
    try {
      await updateBet(betId, { result });
    } catch (error) {
      console.error("Failed to update bet result:", error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const getResultBadge = (result?: "win" | "loss" | "push") => {
    if (!result) return <span className="badge badge-ghost">Pending</span>;

    switch (result) {
      case "win":
        return <span className="badge badge-success">Win</span>;
      case "loss":
        return <span className="badge badge-error">Loss</span>;
      case "push":
        return <span className="badge badge-warning">Push</span>;
    }
  };

  const getMatchDescription = (bet: BetWithMatchData) => {
    if (bet.homeTeam && bet.awayTeam) {
      return `${bet.homeTeam.name} vs ${bet.awayTeam.name}`;
    }
    return "Match data unavailable";
  };

  if (!betsWithMatchData) {
    return (
      <div className="flex justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          Bet History {limit && `(Last ${limit})`}
        </h3>

        <div className="tabs tabs-boxed">
          {(["all", "pending", "win", "loss", "push"] as const).map(
            (filterOption) => (
              <button
                key={filterOption}
                className={`tab ${filter === filterOption ? "tab-active" : ""}`}
                onClick={() => setFilter(filterOption)}
              >
                {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
              </button>
            ),
          )}
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
                <th>Date</th>
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
                  <td>{formatDate(bet.createdAt)}</td>
                  <td>
                    <div className="text-sm">
                      {getMatchDescription(bet)}
                      {bet.match && (
                        <div className="text-xs text-gray-500">
                          {new Date(bet.match.date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="text-sm">
                      {bet.description}
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
                    {bet.result === "loss" && (
                      <span className="text-error">
                        -{formatCurrency(bet.amount)}
                      </span>
                    )}
                    {bet.result === "push" && (
                      <span className="text-warning">$0.00</span>
                    )}
                    {!bet.result && <span className="text-gray-500">-</span>}
                  </td>
                  <td>
                    {!bet.result ? (
                      <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-xs btn-primary">
                          Set Result
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-24 z-10"
                        >
                          <li>
                            <a
                              onClick={() => handleResultUpdate(bet.id, "win")}
                            >
                              Win
                            </a>
                          </li>
                          <li>
                            <a
                              onClick={() => handleResultUpdate(bet.id, "loss")}
                            >
                              Loss
                            </a>
                          </li>
                          <li>
                            <a
                              onClick={() => handleResultUpdate(bet.id, "push")}
                            >
                              Push
                            </a>
                          </li>
                        </ul>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
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
