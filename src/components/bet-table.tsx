import { createSignal, For, Match, Show, Suspense, Switch } from "solid-js";
import { useBets, useDeleteBet, useUpdateBet } from "~/api/bets";
import { useAuth } from "~/contexts/auth";
import { Matchup } from "./matchup";

function useStacked<T>() {
  const [stack, update] = createSignal<T[]>([]);
  return {
    current: () => stack()[0],
    clear: () => update([]),
    push: (item: T) => update((prev) => [item, ...prev]),
    pop: () => update(([_, ...rest]) => rest),
  };
}

// Bet calculations (American odds format)
export const calculatePayout = (amount: number, odds: number): number => {
  if (odds > 0) {
    // Positive odds: +200 means bet $100 to win $200
    return amount + amount * (odds / 100);
  } else {
    // Negative odds: -150 means bet $150 to win $100
    return amount + amount * (100 / Math.abs(odds));
  }
};

export const calculateProfit = (amount: number, odds: number): number => {
  return calculatePayout(amount, odds) - amount;
};

export function BetTable() {
  const [filter, setFilter] = createSignal<"all" | "win" | "lose" | "pending">(
    "all",
  );
  const [selectedMatchId, setSelectedMatchId] = createSignal<number | null>(
    null,
  );
  const {
    current: cursor,
    clear: clearCursor,
    push: next,
    pop: goBack,
  } = useStacked<number>();

  const query = useBets(() => null, cursor);
  const auth = useAuth();
  const deleteBet = useDeleteBet();
  const updateBet = useUpdateBet();

  const betsData = () => query.data?.bets || [];

  const filteredBets = () =>
    betsData().filter((bet) => {
      if (filter() === "all") return true;
      if (filter() === "pending") return bet.result === "pending";
      return bet.result === filter();
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
        return <span class="badge badge-success">Win</span>;
      case "lose":
        return <span class="badge badge-error">Loss</span>;
      case "pending":
        return <span class="badge badge-ghost">Pending</span>;
      default:
        return <span class="badge badge-warning">{result}</span>;
    }
  };

  return (
    <Switch>
      <Match when={query.isError}>
        <div class="flex justify-center p-8">
          <div class="alert alert-error">
            <span>Error loading bet history: {query.error?.message}</span>
          </div>
        </div>
      </Match>

      <Match when>
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-semibold">Bet History</h3>

            <div class="tabs tabs-boxed">
              <For each={["all", "pending", "win", "lose"] as const}>
                {(filterOption) => (
                  <button
                    classList={{
                      tab: true,
                      "tab-active": filter() === filterOption,
                    }}
                    onClick={() => setFilter(filterOption)}
                  >
                    {filterOption.charAt(0).toUpperCase() +
                      filterOption.slice(1)}
                  </button>
                )}
              </For>
            </div>
          </div>

          {filteredBets().length === 0 ? (
            <div class="text-center py-8 text-gray-500">
              No bets found for the selected filter.
            </div>
          ) : (
            <>
              <div class="overflow-x-auto">
                <table class="table table-zebra w-full">
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
                    <For each={filteredBets()}>
                      {(bet) => (
                        <tr>
                          <td>{bet.id}</td>
                          <td>
                            <button
                              class="btn btn-link p-0"
                              onClick={() => setSelectedMatchId(bet.match_id)}
                            >
                              {bet.match_id}
                            </button>
                          </td>
                          <td>
                            <div class="text-sm">
                              {bet.name}
                              {bet.line !== 0 && (
                                <div class="text-xs text-gray-500">
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
                              <span class="text-success">
                                +
                                {formatCurrency(
                                  calculateProfit(bet.amount, bet.odds),
                                )}
                              </span>
                            )}
                            {bet.result === "lose" && (
                              <span class="text-error">
                                -{formatCurrency(bet.amount)}
                              </span>
                            )}
                            {bet.result === "pending" && (
                              <span class="text-warning">
                                +
                                {formatCurrency(
                                  calculateProfit(bet.amount, bet.odds),
                                )}
                              </span>
                            )}
                          </td>
                          <td>
                            <div class="flex justify-center">
                              <Show
                                when={!auth.isReadOnly()}
                                fallback={<span class="text-gray-400">-</span>}
                              >
                                <div class="dropdown dropdown-end">
                                  <label
                                    tabIndex={0}
                                    class="btn btn-xs btn-ghost"
                                  >
                                    <svg
                                      class="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width={2}
                                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z"
                                      />
                                    </svg>
                                  </label>
                                  <ul
                                    tabIndex={0}
                                    class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32"
                                  >
                                    {/* Set Result options */}
                                    <li class="menu-title">
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
                                    {/* Always available actions */}
                                    <li>
                                      <a
                                        onClick={() => handleDelete(bet.id)}
                                        class="text-error"
                                      >
                                        Delete
                                      </a>
                                    </li>
                                  </ul>
                                </div>
                              </Show>
                            </div>
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div class="flex justify-end mt-4">
                <div class="flex items-center gap-2">
                  <Show when={cursor() !== undefined}>
                    <button
                      class="btn btn-sm btn-outline"
                      onClick={clearCursor}
                    >
                      Reset
                    </button>
                  </Show>
                  <button
                    class="btn btn-sm btn-outline"
                    onClick={goBack}
                    disabled={cursor() === undefined}
                  >
                    Prev
                  </button>
                  <button
                    class="btn btn-sm btn-outline"
                    onClick={() => next(query.data?.cursor!)}
                    disabled={query.data?.has_next !== true}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}

          <Show when={selectedMatchId() != null}>
            {/*defer evaluation because a null selectedMatchup will cause type errors*/}
            <Suspense fallback={<div>Loading...</div>}>
              <Matchup
                matchId={selectedMatchId()!}
                onClose={() => {
                  setSelectedMatchId(null);
                }}
              />
            </Suspense>
          </Show>
        </div>
      </Match>
    </Switch>
  );
}
