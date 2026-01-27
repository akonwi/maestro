import { A, useSearchParams } from "@solidjs/router";
import { clientOnly } from "@solidjs/start";
import { useQuery } from "@tanstack/solid-query";
import { createMemo, For, Match, Switch } from "solid-js";
import { fixturesTodayQueryOptions } from "~/api/fixtures";
import { LeagueMenu } from "~/components/league-menu";
import { formatFixtureTime } from "~/lib/formatters";

function Page() {
  const [searchParams, setSearchParams] = useSearchParams<{ date?: string }>();

  const selectedDate = () => {
    return typeof searchParams.date === "string"
      ? searchParams.date
      : new Date().toISOString().split("T")[0] || "";
  };

  const formattedDate = createMemo(() => {
    const date = new Date(`${selectedDate()}T00:00:00`);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  const fixturesQuery = useQuery(() =>
    fixturesTodayQueryOptions(selectedDate()),
  );

  const navigateDate = (direction: "prev" | "next") => {
    const currentDate = new Date(`${selectedDate()}T00:00:00`);
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setDate(currentDate.getDate() - 1);
    } else {
      newDate.setDate(currentDate.getDate() + 1);
    }
    setSearchParams({ date: newDate.toISOString().split("T")[0] });
  };

  const matchupUrl = (fixtureId: number) => `/matchup/${fixtureId}`;

  const leagues = () => fixturesQuery.data ?? [];

  return (
    <div class="space-y-4 md:space-y-6">
      {/* Header - stacks on mobile */}
      <div class="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <h1 class="text-2xl md:text-3xl font-bold">Fixtures</h1>
        <div class="flex items-center justify-between sm:justify-end gap-3 md:gap-4">
          <div class="text-sm md:text-lg font-medium text-base-content/80">
            {formattedDate()}
          </div>
          <div class="flex items-center gap-1 md:gap-2">
            <button
              type="button"
              class="btn btn-xs md:btn-sm btn-outline"
              onClick={() => navigateDate("prev")}
              aria-label="Previous day"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Go Back</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              type="button"
              class="btn btn-xs md:btn-sm btn-outline"
              onClick={() => navigateDate("next")}
              aria-label="Next day"
            >
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Go Forward</title>
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            <button
              type="button"
              class="btn btn-xs md:btn-sm btn-primary"
              onClick={() => {
                const today = new Date().toISOString().split("T")[0] || "";
                setSearchParams({ date: today });
              }}
            >
              Today
            </button>
          </div>
        </div>
      </div>

      <Switch>
        <Match when={fixturesQuery.isError}>
          <div class="alert alert-error">
            <span>
              Failed to load fixtures:{" "}
              {fixturesQuery.error instanceof Error
                ? fixturesQuery.error.message
                : "Unknown error"}
            </span>
          </div>
        </Match>

        <Match when={fixturesQuery.isPending}>
          <div class="flex w-52 flex-col gap-4">
            <div class="skeleton h-32 w-full" />
            <div class="skeleton h-4 w-28" />
            <div class="skeleton h-4 w-full" />
            <div class="skeleton h-4 w-full" />
          </div>
        </Match>

        <Match when={leagues().length === 0}>
          <div class="text-center py-12">
            <div class="text-base-content/60 text-lg">
              No fixtures for followed leagues
            </div>
            <div class="text-base-content/40 text-sm mt-2">
              Try following more leagues to see fixtures
            </div>
          </div>
        </Match>

        <Match when>
          <div class="space-y-4 md:space-y-6">
            <For each={leagues()}>
              {(league) => (
                <div class="card bg-base-100 border border-base-300">
                  <div class="card-body p-3 md:p-6">
                    <LeagueMenu league={league} trigger="context">
                      <h2 class="card-title text-base md:text-lg">
                        {league.name}
                      </h2>
                    </LeagueMenu>
                    <div class="divide-y divide-base-300">
                      <For each={league.fixtures}>
                        {(fixture) => (
                          <A
                            href={matchupUrl(fixture.id)}
                            class="block py-2 md:py-3 hover:bg-base-200 -mx-3 px-3 md:-mx-4 md:px-4 transition-colors"
                          >
                            {/* Mobile layout: stacked, full width */}
                            <div class="md:hidden">
                              <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2 min-w-0 flex-1">
                                  <img
                                    src={`https://media.api-sports.io/football/teams/${fixture.home.id}.png`}
                                    alt={fixture.home.name}
                                    class="w-5 h-5 shrink-0"
                                  />
                                  <span class="text-sm truncate">
                                    {fixture.home.name}
                                  </span>
                                </div>
                                <div class="shrink-0 px-2">
                                  <Switch>
                                    <Match when={fixture.finished}>
                                      <span class="text-sm font-medium">
                                        {fixture.home_goals} -{" "}
                                        {fixture.away_goals}
                                      </span>
                                    </Match>
                                    <Match when>
                                      <span class="text-base-content/50 text-xs">
                                        vs
                                      </span>
                                    </Match>
                                  </Switch>
                                </div>
                                <div class="flex items-center gap-2 min-w-0 flex-1 justify-end">
                                  <span class="text-sm truncate">
                                    {fixture.away.name}
                                  </span>
                                  <img
                                    src={`https://media.api-sports.io/football/teams/${fixture.away.id}.png`}
                                    alt={fixture.away.name}
                                    class="w-5 h-5 shrink-0"
                                  />
                                </div>
                              </div>
                              <div class="text-xs text-base-content/50 mt-1 text-center">
                                {fixture.finished
                                  ? "FT"
                                  : formatFixtureTime(fixture.timestamp)}
                              </div>
                            </div>

                            {/* Desktop layout: horizontal */}
                            <div class="hidden md:flex md:items-center md:justify-between">
                              <div class="flex items-center gap-3 min-w-0 flex-1">
                                <img
                                  src={`https://media.api-sports.io/football/teams/${fixture.home.id}.png`}
                                  alt={fixture.home.name}
                                  class="w-6 h-6 shrink-0"
                                />
                                <span class="text-base font-medium truncate">
                                  {fixture.home.name}
                                </span>
                                <span class="text-base-content/50 text-sm shrink-0">
                                  vs
                                </span>
                                <span class="text-base font-medium truncate">
                                  {fixture.away.name}
                                </span>
                                <img
                                  src={`https://media.api-sports.io/football/teams/${fixture.away.id}.png`}
                                  alt={fixture.away.name}
                                  class="w-6 h-6 shrink-0"
                                />
                              </div>
                              <div class="text-sm text-base-content/60 shrink-0 ml-2">
                                <Switch>
                                  <Match when={fixture.finished}>
                                    <span class="font-medium">
                                      {fixture.home_goals} -{" "}
                                      {fixture.away_goals}
                                    </span>
                                  </Match>
                                  <Match when>
                                    {formatFixtureTime(fixture.timestamp)}
                                  </Match>
                                </Switch>
                              </div>
                            </div>
                          </A>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Match>
      </Switch>
    </div>
  );
}

export default clientOnly(async () => ({ default: Page }), { lazy: true });
