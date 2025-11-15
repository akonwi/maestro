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
  const metricsQuery = useTeamMetrics(() => ({
    teamId: props.teamId,
    season: props.season,
    leagueId: props.leagueId,
  }));

  return (
    <div class="card bg-base-100 border border-base-300">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Game Metrics</h3>
        <Show when={metricsQuery.data}>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Offensive Metrics */}
            <div>
              <h4 class="font-medium mb-3 text-success">Offensive Metrics</h4>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-sm">Total Shots</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.for.shots.total}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.for.shots.total || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Shots on Goal</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.for.shots.onGoal}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.for.shots.onGoal || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Shots Missed</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.for.shots.missed}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.for.shots.missed || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Blocked Shots</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.for.shots.blocked}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.for.shots.blocked || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Shots Inside Box</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.for.shots.insideBox}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.for.shots.insideBox || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Expected Goals (xG)</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.for.xg.toFixed(2)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.for.xg || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(2)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Corner Kicks</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.for.corners}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.for.corners || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Defensive Metrics */}
            <div>
              <h4 class="font-medium mb-3 text-error">Defensive Metrics</h4>
              <div class="space-y-3">
                <div class="flex justify-between items-center">
                  <span class="text-sm">Total Shots Against</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.against.shots.total}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.against.shots.total || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Shots on Goal Against</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.against.shots.onGoal}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.against.shots.onGoal || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Shots Missed Against</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.against.shots.missed}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.against.shots.missed || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Blocked Shots Against</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.against.shots.blocked}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.against.shots.blocked || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Shots Inside Box Against</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.against.shots.insideBox}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.against.shots.insideBox || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Expected Goals Against (xGA)</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.against.xg.toFixed(2)}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.against.xg || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(2)}{" "}
                      per game)
                    </div>
                  </div>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm">Corner Kicks Against</span>
                  <div class="text-right">
                    <div class="font-medium">
                      {metricsQuery.data?.against.corners}
                    </div>
                    <div class="text-xs text-base-content/60">
                      (
                      {(
                        (metricsQuery.data?.against.corners || 0) /
                        (props.gamesPlayed() || 1)
                      ).toFixed(1)}{" "}
                      per game)
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
