import { A, useSearchParams } from "@solidjs/router";
import { clientOnly } from "@solidjs/start";
import { useQuery } from "@tanstack/solid-query";
import { createMemo, For, Match, Switch } from "solid-js";
import { fixturesTodayQueryOptions, type Fixture } from "~/api/fixtures";
import { LeagueMenu } from "~/components/league-menu";
import { useScrollRestoration } from "~/hooks/use-scroll-restoration";
import { formatFixtureTime } from "~/lib/formatters";

function Page() {
  useScrollRestoration();

  const [searchParams, setSearchParams] = useSearchParams<{ date?: string }>();

  const selectedDate = () => {
    const dateParam = Array.isArray(searchParams.date)
      ? searchParams.date[0]
      : searchParams.date;
    return dateParam || new Date().toISOString().split("T")[0] || "";
  };

  const setSelectedDate = (date: string) => {
    if (date === new Date().toISOString().split("T")[0]) {
      setSearchParams({ date: undefined });
    } else {
      setSearchParams({ date });
    }
  };

  const formattedDate = createMemo(() => {
    const date = new Date(selectedDate() + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  const fixturesQuery = useQuery(() => fixturesTodayQueryOptions(selectedDate()));

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

  const formatMatchup = (fixture: Fixture) => {
    return `${fixture.home.name} vs ${fixture.away.name}`;
  };

  const matchupUrl = (fixtureId: number) => `/matchup/${fixtureId}`;

  return (
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <h1 class="text-3xl font-bold">Fixtures</h1>
        <div class="flex items-center gap-4">
          <div class="text-lg font-medium text-base-content/80">
            {formattedDate()}
          </div>
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

        <Match when={(fixturesQuery.data || []).length === 0}>
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
          <div class="space-y-6">
            <For each={fixturesQuery.data}>
              {league => (
                <div class="card bg-base-100 border border-base-300">
                  <div class="card-body">
                    <LeagueMenu league={league} trigger="context">
                      <h2 class="card-title text-lg">{league.name}</h2>
                    </LeagueMenu>
                    <div class="divide-y divide-base-300">
                      <For each={league.fixtures}>
                        {fixture => (
                          <A
                            href={matchupUrl(fixture.id)}
                            class="flex items-center justify-between py-3 hover:bg-base-200 -mx-4 px-4 transition-colors"
                          >
                            <div class="flex items-center gap-3">
                              <img
                                src={`https://media.api-sports.io/football/teams/${fixture.home.id}.png`}
                                alt={fixture.home.name}
                                class="w-6 h-6"
                              />
                              <span class="font-medium">{fixture.home.name}</span>
                              <span class="text-base-content/50">vs</span>
                              <span class="font-medium">{fixture.away.name}</span>
                              <img
                                src={`https://media.api-sports.io/football/teams/${fixture.away.id}.png`}
                                alt={fixture.away.name}
                                class="w-6 h-6"
                              />
                            </div>
                            <div class="text-sm text-base-content/60">
                              <Switch>
                                <Match when={fixture.finished}>
                                  <span class="font-medium">
                                    {fixture.home_goals} - {fixture.away_goals}
                                  </span>
                                </Match>
                                <Match when>
                                  {formatFixtureTime(fixture.timestamp)}
                                </Match>
                              </Switch>
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
