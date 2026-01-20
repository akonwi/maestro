import { useQuery } from "@tanstack/solid-query";
import { For, Show } from "solid-js";
import { type TeamMetrics, teamMetricsQueryOptions } from "~/api/analysis";
import { useAuth } from "~/contexts/auth";

interface GameMetricsProps {
  teamId: number;
  leagueId: number;
  season: number;
  limit?: number;
}

type MetricConfig = {
  label: string;
  getValue: (data: TeamMetrics["for"]) => { perGame: number; total: number };
  decimals?: number;
};

const METRICS: MetricConfig[] = [
  {
    label: "Total Shots",
    getValue: d => ({
      perGame: d.perGame.shots.total,
      total: d.total.shots.total,
    }),
  },
  {
    label: "Shots on Goal",
    getValue: d => ({
      perGame: d.perGame.shots.onGoal,
      total: d.total.shots.onGoal,
    }),
  },
  {
    label: "Shots Missed",
    getValue: d => ({
      perGame: d.perGame.shots.missed,
      total: d.total.shots.missed,
    }),
  },
  {
    label: "Blocked Shots",
    getValue: d => ({
      perGame: d.perGame.shots.blocked,
      total: d.total.shots.blocked,
    }),
  },
  {
    label: "Shots Inside Box",
    getValue: d => ({
      perGame: d.perGame.shots.insideBox,
      total: d.total.shots.insideBox,
    }),
  },
  {
    label: "Shots Outside Box",
    getValue: d => ({
      perGame: d.perGame.shots.outsideBox,
      total: d.total.shots.outsideBox,
    }),
  },
  {
    label: "Expected Goals",
    getValue: d => ({ perGame: d.perGame.xg, total: d.total.xg }),
    decimals: 2,
  },
  {
    label: "Corner Kicks",
    getValue: d => ({ perGame: d.perGame.corners, total: d.total.corners }),
  },
];

function MetricItem(props: {
  label: string;
  perGame: number;
  total: number;
  decimals?: number;
}) {
  const decimals = props.decimals ?? 1;
  return (
    <div class="flex-1 min-w-[150px]">
      <div class="text-sm text-base-content/70">{props.label}</div>
      <div class="text-2xl font-medium">{props.perGame.toFixed(decimals)}</div>
      <div class="text-xs text-base-content/60">
        {decimals === 2 ? props.total.toFixed(2) : props.total}
      </div>
    </div>
  );
}

function MetricSection(props: {
  title: string;
  titleClass?: string;
  data: TeamMetrics["for"];
  layout: "grid" | "flex";
}) {
  return (
    <div>
      <h4 class={`font-medium mb-4 ${props.titleClass ?? ""}`}>
        {props.title}
      </h4>
      <div
        class={props.layout === "grid" ? "space-y-4" : "flex gap-4 flex-wrap"}
      >
        <For each={METRICS}>
          {metric => {
            const values = metric.getValue(props.data);
            return (
              <MetricItem
                label={metric.label}
                perGame={values.perGame}
                total={values.total}
                decimals={metric.decimals}
              />
            );
          }}
        </For>
      </div>
    </div>
  );
}

export function GameMetrics(props: GameMetricsProps) {
  const auth = useAuth();
  const metricsQuery = useQuery(() =>
    teamMetricsQueryOptions(
      {
        teamId: props.teamId,
        leagueId: props.leagueId,
        season: props.season,
        limit: props.limit,
      },
      auth.headers,
    ),
  );

  return (
    <div class="card bg-base-100 border border-base-300">
      <div class="card-body">
        <h3 class="text-lg font-semibold mb-4">Game Metrics</h3>
        <Show when={metricsQuery.data}>
          {data => (
            <div>
              {/* Mobile Layout: 2 columns side by side */}
              <div class="grid grid-cols-2 gap-4 md:hidden">
                <MetricSection
                  title="Offensive"
                  titleClass="text-primary"
                  data={data().for}
                  layout="grid"
                />
                <MetricSection
                  title="Defensive"
                  data={data().against}
                  layout="grid"
                />
              </div>

              {/* Desktop Layout: Stacked rows */}
              <div class="hidden md:block md:space-y-6">
                <MetricSection
                  title="Offensive"
                  titleClass="text-primary"
                  data={data().for}
                  layout="flex"
                />
                <MetricSection
                  title="Defensive"
                  data={data().against}
                  layout="flex"
                />
              </div>
            </div>
          )}
        </Show>

        <Show when={metricsQuery.isError}>
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
        <div class="skeleton h-4 w-full" />
        <div class="skeleton h-4 w-3/4" />
        <div class="skeleton h-4 w-1/2" />
      </div>
    </div>
  </div>
);
