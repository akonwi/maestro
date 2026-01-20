import { A, useSearchParams } from "@solidjs/router";
import { clientOnly } from "@solidjs/start";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Show,
  Switch,
  useContext,
} from "solid-js";
import type { Fixture } from "~/api/fixtures";
import { BetFormContext } from "~/components/bet-form.context";
import { useAuth } from "~/contexts/auth";
import { useJuice } from "~/hooks/data/use-juice";
import { useScrollRestoration } from "~/hooks/use-scroll-restoration";
import { formatFixtureTime, formatOdds } from "~/lib/formatters";

function Page() {
  useScrollRestoration();

  // Responsive view mode based on viewport size
  const [viewMode, setViewMode] = createSignal<"list" | "table">("list");
  const onResize = () => {
    setViewMode(window?.innerWidth >= 1024 ? "table" : "list");
  };
  // Update view mode based on viewport size
  window.addEventListener("resize", onResize);
  onCleanup(() => window?.removeEventListener("resize", onResize));

  // Table sorting state with localStorage persistence
  const savedSort = localStorage.getItem("valueBetsSortByOdds");
  const [sortByOdds, setSortByOdds] = createSignal<"asc" | "desc" | null>(
    savedSort === "asc" || savedSort === "desc" ? savedSort : null,
  );

  // Persist sort setting to localStorage
  createEffect(() => {
    const sort = sortByOdds();
    if (sort === null) {
      localStorage.removeItem("valueBetsSortByOdds");
    } else {
      localStorage.setItem("valueBetsSortByOdds", sort);
    }
  });

  // Date navigation state from URL search params
  const [searchParams, setSearchParams] = useSearchParams<{
    date?: string;
  }>();

  const selectedDate = () => {
    const dateParam = Array.isArray(searchParams.date)
      ? searchParams.date[0]
      : searchParams.date;
    return dateParam || new Date().toISOString().split("T")[0] || "";
  };
  const setSelectedDate = (date: string) => {
    if (date === new Date().toISOString().split("T")[0]) {
      setSearchParams({ date: undefined }); // Remove date param if it's today
    } else {
      setSearchParams({ date });
    }
  };

  const matchupUrl = (fixtureId: number) => `/matchup/${fixtureId}`;

  const formattedDate = createMemo(() => {
    const date = new Date(selectedDate() + "T00:00:00"); // Ensure consistent timezone
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  const juiceQuery = useJuice(selectedDate);
  const auth = useAuth();

  // Date navigation functions
  const navigateDate = (direction: "prev" | "next") => {
    const currentDate = new Date(selectedDate() + "T00:00:00");
    const newDate = new Date(currentDate);

    if (direction === "prev") {
      newDate.setDate(currentDate.getDate() - 1);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }

    const newDateStr = newDate.toISOString().split("T")[0]!;
    setSelectedDate(newDateStr);
  };

  const [_, betForm] = useContext(BetFormContext);

  const formatMatchup = (fixture: Fixture) => {
    return `${fixture.home.name} vs ${fixture.away.name}`;
  };

  // Table sorting functions
  const handleOddsSort = () => {
    setSortByOdds(current => {
      if (current === null) return "desc";
      if (current === "desc") return "asc";
      return null;
    });
  };

  // Prepare table data with sorting
  const juice = createMemo(() => {
    if (juiceQuery.data == undefined || juiceQuery.data.length === 0) return [];

    const valueBets = juiceQuery.data;
    const flattened = valueBets.flatMap(bet =>
      bet.stats.flatMap(betType =>
        betType.values.map((value, valueIndex) => ({
          bet,
          betType,
          value,
          valueIndex,
          key: `${bet.fixture.id}-${betType.id}-${valueIndex}`,
        })),
      ),
    );

    if (sortByOdds() === null) return flattened;

    return flattened.sort((a, b) => {
      const aOdds = a.value.odd;
      const bOdds = b.value.odd;
      if (sortByOdds() === "asc") {
        return aOdds - bOdds;
      } else {
        return bOdds - aOdds;
      }
    });
  });

  return (
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl font-bold">Value Bets</h1>
        <div class="flex items-center gap-4">
          {/* Date Display */}
          <div class="text-lg font-medium text-base-content/80">
            {formattedDate()}
          </div>

          {/* Navigation Buttons */}
          <div class="flex items-center gap-2">
            <button
              class="btn btn-sm btn-outline"
              onClick={() => navigateDate("prev")}
              aria-label="Previous day"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <button
              class="btn btn-sm btn-outline"
              onClick={() => navigateDate("next")}
              aria-label="Next day"
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            {/* Today Button */}
            <button
              class="btn btn-sm btn-primary"
              onClick={() => {
                const today = new Date().toISOString().split("T")[0] || "";
                setSelectedDate(today);
              }}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      <Switch>
        <Match when={juiceQuery.error}>
          <div class="alert alert-error">
            <span>
              Failed to load value bets:{" "}
              {juiceQuery.error instanceof Error
                ? juiceQuery.error.message
                : "Unknown error"}
            </span>
          </div>
        </Match>

        <Match when={juiceQuery.isLoading}>
          <div class="flex w-52 flex-col gap-4">
            <div class="skeleton h-32 w-full"></div>
            <div class="skeleton h-4 w-28"></div>
            <div class="skeleton h-4 w-full"></div>
            <div class="skeleton h-4 w-full"></div>
          </div>
        </Match>

        <Match when={(juiceQuery.data || []).length === 0}>
          <div class="text-center py-12">
            <div class="text-base-content/60 text-lg">
              No value bets available right now
            </div>
            <div class="text-base-content/40 text-sm mt-2">
              Check back later for new opportunities
            </div>
          </div>
        </Match>

        <Match when={viewMode() === "list"}>
          <div class="space-y-4">
            <For each={juiceQuery.data}>
              {bet => (
                <div class="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow">
                  <div class="card-body">
                    <div class="flex flex-col gap-4">
                      {/* Match Header */}
                      <div class="flex justify-between items-start">
                        <div>
                          <A
                            href={matchupUrl(bet.fixture.id)}
                            target="_blank"
                            class="text-lg font-semibold hover:text-primary transition-colors"
                          >
                            {formatMatchup(bet.fixture)}
                          </A>
                          <p class="text-base-content/60 text-sm">
                            {bet.fixture.league.name} •{" "}
                            {formatFixtureTime(bet.fixture.timestamp)}
                          </p>
                        </div>
                        <div class="flex items-center gap-2">
                          <img
                            src={`https://media.api-sports.io/football/teams/${bet.fixture.home.id}.png`}
                            alt={bet.fixture.home.name}
                            class="w-6 h-6"
                          />
                          <span class="text-sm">vs</span>
                          <img
                            src={`https://media.api-sports.io/football/teams/${bet.fixture.away.id}.png`}
                            alt={bet.fixture.away.name}
                            class="w-6 h-6"
                          />
                        </div>
                      </div>

                      {/* Betting Markets */}
                      <div class="space-y-3">
                        <For each={bet.stats}>
                          {betType => (
                            <div class="bg-base-200 p-3 rounded-lg">
                              <h4 class="font-medium text-sm mb-2">
                                {betType.name}
                              </h4>
                              <div class="flex flex-wrap gap-2">
                                <For each={betType.values}>
                                  {value => (
                                    <button
                                      aria-disabled={auth.isReadOnly()}
                                      class="badge badge-lg badge-primary cursor-pointer hover:badge-primary-focus transition-colors aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                                      onClick={() =>
                                        betForm.show(bet.fixture.id, {
                                          type_id: betType.id,
                                          odds: value.odd,
                                          description: betType.name,
                                        })
                                      }
                                    >
                                      {value.name}: {formatOdds(value.odd)}
                                    </button>
                                  )}
                                </For>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Match>

        <Match when>
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th
                    class="cursor-pointer hover:bg-base-200 select-none"
                    onClick={handleOddsSort}
                  >
                    <div class="flex items-center gap-1">
                      Odds
                      <Show when={sortByOdds() != null}>
                        <svg
                          class={`w-4 h-4 transition-transform ${
                            sortByOdds() === "desc" ? "rotate-180" : "rotate-0"
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width={2}
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </Show>
                    </div>
                  </th>
                  <th>Bet Name</th>
                  <th>Match</th>
                  <th>League</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                <For each={juice()}>
                  {({ bet, betType, value }) => (
                    <tr class="hover:bg-base-200 transition-colors">
                      <td class="font-medium">
                        <span class="badge badge-primary">
                          {formatOdds(value.odd)}
                        </span>
                      </td>
                      <td>
                        <div class="text-sm">
                          <div class="font-medium">{betType.name}</div>
                          <div class="text-base-content/60">{value.name}</div>
                        </div>
                      </td>
                      <td>
                        <A
                          href={matchupUrl(bet.fixture.id)}
                          target="_blank"
                          class="hover:text-primary transition-colors"
                        >
                          {formatMatchup(bet.fixture)}
                        </A>
                      </td>
                      <td>{bet.fixture.league.name}</td>
                      <td>{formatFixtureTime(bet.fixture.timestamp)}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

export default clientOnly(async () => ({ default: Page }), { lazy: true });
