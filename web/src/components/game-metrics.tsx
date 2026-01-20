import { Show } from "solid-js";
import { useTeamMetrics } from "~/api/analysis";

interface GameMetricsProps {
  teamId: number;
  leagueId: number;
  season: number;
  limit?: number;
}

export function GameMetrics(props: GameMetricsProps) {
  const metricsQuery = useTeamMetrics(() => ({
    teamId: props.teamId,
    leagueId: props.leagueId,
    season: props.season,
    limit: props.limit,
  }));

  return (
    <div class="card bg-base-100 border border-base-300">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Game Metrics</h3>
        <Show when={metricsQuery.data}>
          <div>
            {/* Mobile Layout: 2 columns */}
            <div class="grid grid-cols-2 gap-4 md:hidden">
              <div>
                <h4 class="font-medium mb-4 text-primary">Offensive</h4>
                <div class="space-y-4">
                  <div>
                    <div class="text-sm text-base-content/70">Total Shots</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data?.for.perGame.shots.total.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data?.for.total.shots.total}
                    </div>
                  </div>
                  <div>
                    <div class="text-sm text-base-content/70">
                      Shots on Goal
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data?.for.perGame.shots.onGoal.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data?.for.total.shots.onGoal}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Missed</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data?.for.perGame.shots.missed.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data?.for.total.shots.missed}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Blocked Shots
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data?.for.perGame.shots.blocked.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data?.for.total.shots.blocked}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Shots Inside Box
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.shots.insideBox.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.shots.insideBox}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Shots Outside Box
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.shots.outsideBox.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.shots.outsideBox}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Expected Goals (xG)
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.xg.toFixed(2)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.xg.toFixed(2)}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Corner Kicks</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.corners.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.corners}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 class="font-medium mb-4">Defensive</h4>
                <div class="space-y-4">
                  <div>
                    <div class="text-sm text-base-content/70">Total Shots</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.total.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.total}
                    </div>
                  </div>
                  <div>
                    <div class="text-sm text-base-content/70">
                      Shots on Goal
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.onGoal.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.onGoal}
                    </div>
                  </div>
                  <div>
                    <div class="text-sm text-base-content/70">Shots Missed</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.missed.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.missed}
                    </div>
                  </div>
                  <div>
                    <div class="text-sm text-base-content/70">
                      Blocked Shots
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.blocked.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.blocked}
                    </div>
                  </div>
                  <div>
                    <div class="text-sm text-base-content/70">
                      Shots Inside Box
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.insideBox.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.insideBox}
                    </div>
                  </div>
                  <div>
                    <div class="text-sm text-base-content/70">
                      Shots Outside Box
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.outsideBox.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.outsideBox}
                    </div>
                  </div>
                  <div>
                    <div class="text-sm text-base-content/70">
                      Expected Goals (xGA)
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.xg.toFixed(2)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.xg.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div class="text-sm text-base-content/70">Corner Kicks</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.corners.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.corners}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Desktop Layout: Stacked rows */}
            <div class="hidden md:space-y-6 md:block">
              <div>
                <h4 class="font-medium mb-4 text-primary">Offensive</h4>
                <div class="flex gap-4 flex-wrap">
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Total Shots</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.shots.total.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.shots.total}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Shots on Goal
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.shots.onGoal.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.shots.onGoal}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Missed</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.shots.missed.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.shots.missed}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Blocked Shots
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.shots.blocked.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.shots.blocked}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Shots Inside Box
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.shots.insideBox.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.shots.insideBox}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Shots Outside Box
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.shots.outsideBox.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.shots.outsideBox}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Expected Goals (xG)
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.xg.toFixed(2)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.xg.toFixed(2)}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Corner Kicks</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.for.perGame.corners.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.for.total.corners}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 class="font-medium mb-4">Defensive</h4>
                <div class="flex gap-4 flex-wrap">
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Total Shots Against
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.total.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.total}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Shots on Goal
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.onGoal.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.onGoal}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Missed</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.missed.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.missed}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Blocked Shots
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.blocked.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.blocked}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Shots Inside Box
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.insideBox.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.insideBox}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Shots Outside Box
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.shots.outsideBox.toFixed(
                        1,
                      )}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.shots.outsideBox}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">
                      Expected Goals (xGA)
                    </div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.xg.toFixed(2)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.xg.toFixed(2)}
                    </div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Corner Kicks</div>
                    <div class="text-2xl font-medium">
                      {metricsQuery.data!.against.perGame.corners.toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      {metricsQuery.data!.against.total.corners}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Show>

        <Show when={metricsQuery.error}>
          <div class="alert alert-error">
            <span>
              Failed to load game metrics:{" "}
              {metricsQuery.error instanceof Error
                ? metricsQuery.error.message
                : "Unknown error"}
            </span>
          </div>
        </Show>
      </div>
    </div>
  );
}

GameMetrics.Loading = () => (
  <div class="card bg-base-100 border border-base-300">
    <div class="card-body">
      <h3 class="text-lg font-semibold mb-4">Game Metrics</h3>
      <div class="flex w-52 flex-col gap-4">
        <div class="skeleton h-4 w-full"></div>
        <div class="skeleton h-4 w-3/4"></div>
        <div class="skeleton h-4 w-1/2"></div>
      </div>
    </div>
  </div>
);
