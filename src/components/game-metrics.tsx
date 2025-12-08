import { Show } from "solid-js";
import { useTeamMetrics } from "~/api/analysis";
import { TeamMetrics } from "~/api/analysis";

interface GameMetricsProps {
  teamId: number;
  leagueId: number;
  season: number;
  gamesPlayed: () => number;
}

export default function GameMetrics(props: GameMetricsProps) {
  const metricsQuery = useTeamMetrics(props);

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
                    {(
                      (metricsQuery.data?.for.shots.total || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.total}</div>
                </div>
                <div>
                  <div class="text-sm text-base-content/70">Shots on Goal</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.for.shots.onGoal || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.onGoal}</div>
                </div>
                <div class="flex-1 min-w-[150px]">
                  <div class="text-sm text-base-content/70">Shots Missed</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.for.shots.missed || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.missed}</div>
                </div>
                <div class="flex-1 min-w-[150px]">
                  <div class="text-sm text-base-content/70">Blocked Shots</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.for.shots.blocked || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.blocked}</div>
                </div>
                <div class="flex-1 min-w-[150px]">
                   <div class="text-sm text-base-content/70">Shots Inside Box</div>
                   <div class="text-2xl font-medium">
                     {(
                       (metricsQuery.data?.for.shots.insideBox || 0) /
                       (props.gamesPlayed() || 1)
                     ).toFixed(1)}
                   </div>
                   <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.insideBox}</div>
                 </div>
                 <div class="flex-1 min-w-[150px]">
                   <div class="text-sm text-base-content/70">Shots Outside Box</div>
                   <div class="text-2xl font-medium">
                     {(
                       (metricsQuery.data?.for.shots.outsideBox || 0) /
                       (props.gamesPlayed() || 1)
                     ).toFixed(1)}
                   </div>
                   <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.outsideBox}</div>
                 </div>
                 <div class="flex-1 min-w-[150px]">
                   <div class="text-sm text-base-content/70">Expected Goals (xG)</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.for.xg || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(2)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.for.xg.toFixed(2)}</div>
                </div>
                <div class="flex-1 min-w-[150px]">
                  <div class="text-sm text-base-content/70">Corner Kicks</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.for.corners || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.for.corners}</div>
                </div>
              </div>
              </div>

              <div>
                <h4 class="font-medium mb-4">Defensive</h4>
                <div class="space-y-4">
                  <div>
                    <div class="text-sm text-base-content/70">Total Shots</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.against.shots.total || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.total}</div>
                </div>
                <div>
                  <div class="text-sm text-base-content/70">Shots on Goal</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.against.shots.onGoal || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.onGoal}</div>
                </div>
                <div>
                  <div class="text-sm text-base-content/70">Shots Missed</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.against.shots.missed || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.missed}</div>
                </div>
                <div>
                  <div class="text-sm text-base-content/70">Blocked Shots</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.against.shots.blocked || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.blocked}</div>
                </div>
                <div>
                  <div class="text-sm text-base-content/70">Shots Inside Box</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.against.shots.insideBox || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.insideBox}</div>
                </div>
                <div>
                  <div class="text-sm text-base-content/70">Shots Outside Box</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.against.shots.outsideBox || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.outsideBox}</div>
                </div>
                <div>
                  <div class="text-sm text-base-content/70">Expected Goals (xGA)</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.against.xg || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(2)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.against.xg.toFixed(2)}</div>
                </div>
                <div>
                  <div class="text-sm text-base-content/70">Corner Kicks</div>
                  <div class="text-2xl font-medium">
                    {(
                      (metricsQuery.data?.against.corners || 0) /
                      (props.gamesPlayed() || 1)
                    ).toFixed(1)}
                  </div>
                  <div class="text-xs text-base-content/60">{metricsQuery.data?.against.corners}</div>
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
                      {(
                        (metricsQuery.data?.for.shots.total || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.total}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots on Goal</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.for.shots.onGoal || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.onGoal}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Missed</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.for.shots.missed || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.missed}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Blocked Shots</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.for.shots.blocked || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.blocked}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Inside Box</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.for.shots.insideBox || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.insideBox}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Outside Box</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.for.shots.outsideBox || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.for.shots.outsideBox}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Expected Goals (xG)</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.for.xg || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(2)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.for.xg.toFixed(2)}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Corner Kicks</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.for.corners || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.for.corners}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 class="font-medium mb-4">Defensive</h4>
                <div class="flex gap-4 flex-wrap">
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Total Shots Against</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.against.shots.total || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.total}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots on Goal</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.against.shots.onGoal || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.onGoal}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Missed</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.against.shots.missed || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.missed}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Blocked Shots</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.against.shots.blocked || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.blocked}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Inside Box</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.against.shots.insideBox || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.insideBox}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Shots Outside Box</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.against.shots.outsideBox || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.against.shots.outsideBox}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Expected Goals (xGA)</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.against.xg || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(2)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.against.xg.toFixed(2)}</div>
                  </div>
                  <div class="flex-1 min-w-[150px]">
                    <div class="text-sm text-base-content/70">Corner Kicks</div>
                    <div class="text-2xl font-medium">
                      {(
                        (metricsQuery.data?.against.corners || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}
                    </div>
                    <div class="text-xs text-base-content/60">{metricsQuery.data?.against.corners}</div>
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

GameMetrics.Loading = function () {
  return (
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
};
