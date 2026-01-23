import { useQuery } from "@tanstack/solid-query";
import { createSignal, Match, Switch } from "solid-js";
import { type TeamMetrics, teamMetricsQueryOptions } from "~/api/analysis";
import { useAuth } from "~/contexts/auth";
import { RadarChart } from "./radar-chart";

interface MetricsMatchupProps {
  homeId: number;
  awayId: number;
  homeName: string;
  awayName: string;
  leagueId: number;
  season: number;
  limit?: number;
  venueView?: "contextual" | "full";
}

interface MetricBarProps {
  label: string;
  attackValue: number;
  defenseValue: number;
  attackLabel: string;
  defenseLabel: string;
  formatValue?: (v: number) => string;
}

function MetricBar(props: MetricBarProps) {
  const format = () => props.formatValue ?? ((v: number) => v.toFixed(1));
  const total = () => props.attackValue + props.defenseValue;
  const attackPercent = () =>
    total() > 0 ? (props.attackValue / total()) * 100 : 50;
  const defensePercent = () =>
    total() > 0 ? (props.defenseValue / total()) * 100 : 50;

  // Higher attack is generally better, higher defense allowed is worse
  const attackWins = () => props.attackValue > props.defenseValue;

  return (
    <div class="space-y-1">
      <div class="flex justify-between text-sm">
        <span class="text-base-content/70">{props.attackLabel}</span>
        <span class="font-medium">{props.label}</span>
        <span class="text-base-content/70">{props.defenseLabel}</span>
      </div>
      <div class="flex h-6 rounded-lg overflow-hidden bg-base-200">
        <div
          class={`flex items-center justify-start pl-2 text-xs font-medium transition-all ${
            attackWins() ? "bg-primary text-primary-content" : "bg-base-300"
          }`}
          style={{ width: `${attackPercent()}%` }}
        >
          {format()(props.attackValue)}
        </div>
        <div
          class={`flex items-center justify-end pr-2 text-xs font-medium transition-all ${
            !attackWins()
              ? "bg-secondary text-secondary-content"
              : "bg-base-300"
          }`}
          style={{ width: `${defensePercent()}%` }}
        >
          {format()(props.defenseValue)}
        </div>
      </div>
    </div>
  );
}

function MatchupSection(props: {
  title: string;
  subtitle: string;
  attackMetrics: TeamMetrics["for"];
  defenseMetrics: TeamMetrics["against"];
  attackLabel: string;
  defenseLabel: string;
}) {
  return (
    <div class="space-y-4">
      <div>
        <h4 class="font-medium">{props.title}</h4>
        <p class="text-sm text-base-content/60">{props.subtitle}</p>
      </div>
      <div class="space-y-3">
        <MetricBar
          label="Shots/Game"
          attackValue={props.attackMetrics.perGame.shots.total}
          defenseValue={props.defenseMetrics.perGame.shots.total}
          attackLabel={props.attackLabel}
          defenseLabel={props.defenseLabel}
        />
        <MetricBar
          label="On Target/Game"
          attackValue={props.attackMetrics.perGame.shots.onGoal}
          defenseValue={props.defenseMetrics.perGame.shots.onGoal}
          attackLabel={props.attackLabel}
          defenseLabel={props.defenseLabel}
        />
        <MetricBar
          label="Missed/Game"
          attackValue={props.attackMetrics.perGame.shots.missed}
          defenseValue={props.defenseMetrics.perGame.shots.missed}
          attackLabel={props.attackLabel}
          defenseLabel={props.defenseLabel}
        />
        <MetricBar
          label="Blocked/Game"
          attackValue={props.attackMetrics.perGame.shots.blocked}
          defenseValue={props.defenseMetrics.perGame.shots.blocked}
          attackLabel={props.attackLabel}
          defenseLabel={props.defenseLabel}
        />
        <MetricBar
          label="In Box/Game"
          attackValue={props.attackMetrics.perGame.shots.insideBox}
          defenseValue={props.defenseMetrics.perGame.shots.insideBox}
          attackLabel={props.attackLabel}
          defenseLabel={props.defenseLabel}
        />
        <MetricBar
          label="Outside Box/Game"
          attackValue={props.attackMetrics.perGame.shots.outsideBox}
          defenseValue={props.defenseMetrics.perGame.shots.outsideBox}
          attackLabel={props.attackLabel}
          defenseLabel={props.defenseLabel}
        />
        <MetricBar
          label="xG/Game"
          attackValue={props.attackMetrics.perGame.xg}
          defenseValue={props.defenseMetrics.perGame.xg}
          attackLabel={props.attackLabel}
          defenseLabel={props.defenseLabel}
          formatValue={(v) => v.toFixed(2)}
        />
        <MetricBar
          label="Corners/Game"
          attackValue={props.attackMetrics.perGame.corners}
          defenseValue={props.defenseMetrics.perGame.corners}
          attackLabel={props.attackLabel}
          defenseLabel={props.defenseLabel}
        />
      </div>
    </div>
  );
}

function buildRadarData(
  attackMetrics: TeamMetrics["for"],
  defenseMetrics: TeamMetrics["against"],
) {
  return [
    {
      label: "Shots",
      attack: attackMetrics.perGame.shots.total,
      defense: defenseMetrics.perGame.shots.total,
    },
    {
      label: "On Target",
      attack: attackMetrics.perGame.shots.onGoal,
      defense: defenseMetrics.perGame.shots.onGoal,
    },
    {
      label: "In Box",
      attack: attackMetrics.perGame.shots.insideBox,
      defense: defenseMetrics.perGame.shots.insideBox,
    },
    {
      label: "xG",
      attack: attackMetrics.perGame.xg,
      defense: defenseMetrics.perGame.xg,
    },
    {
      label: "Corners",
      attack: attackMetrics.perGame.corners,
      defense: defenseMetrics.perGame.corners,
    },
    {
      label: "Blocked",
      attack: attackMetrics.perGame.shots.blocked,
      defense: defenseMetrics.perGame.shots.blocked,
    },
  ];
}

export function MetricsMatchup(props: MetricsMatchupProps) {
  const auth = useAuth();
  const [viewMode, setViewMode] = createSignal<"bars" | "radar">("bars");

  const homeMetricsQuery = useQuery(() =>
    teamMetricsQueryOptions(
      {
        teamId: props.homeId,
        leagueId: props.leagueId,
        season: props.season,
        limit: props.limit,
        venue: props.venueView === "contextual" ? "home" : undefined,
      },
      auth.headers,
    ),
  );

  const awayMetricsQuery = useQuery(() =>
    teamMetricsQueryOptions(
      {
        teamId: props.awayId,
        leagueId: props.leagueId,
        season: props.season,
        limit: props.limit,
        venue: props.venueView === "contextual" ? "away" : undefined,
      },
      auth.headers,
    ),
  );

  const isPending = () =>
    homeMetricsQuery.isPending || awayMetricsQuery.isPending;
  const hasError = () => homeMetricsQuery.isError || awayMetricsQuery.isError;
  const hasData = () => homeMetricsQuery.data && awayMetricsQuery.data;

  return (
    <div class="card bg-base-100 border border-base-300">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Attack vs Defense</h3>
          <div class="tabs tabs-boxed tabs-sm">
            <button
              class={`tab ${viewMode() === "bars" ? "tab-active" : ""}`}
              onClick={() => setViewMode("bars")}
            >
              Bars
            </button>
            <button
              class={`tab ${viewMode() === "radar" ? "tab-active" : ""}`}
              onClick={() => setViewMode("radar")}
            >
              Radar
            </button>
          </div>
        </div>

        <Switch>
          <Match when={isPending()}>
            <div class="flex flex-col gap-4">
              <div class="skeleton h-4 w-full" />
              <div class="skeleton h-6 w-full" />
              <div class="skeleton h-4 w-full" />
              <div class="skeleton h-6 w-full" />
            </div>
          </Match>

          <Match when={hasError()}>
            <div class="alert alert-error">
              <span>
                Failed to load metrics:{" "}
                {homeMetricsQuery.error instanceof Error
                  ? homeMetricsQuery.error.message
                  : awayMetricsQuery.error instanceof Error
                    ? awayMetricsQuery.error.message
                    : "Unknown error"}
              </span>
            </div>
          </Match>

          <Match when={hasData()}>
            <Switch>
              <Match when={viewMode() === "bars"}>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <MatchupSection
                    title={`${props.homeName} Attack`}
                    subtitle={`vs ${props.awayName} Defense`}
                    attackMetrics={homeMetricsQuery.data!.for}
                    defenseMetrics={awayMetricsQuery.data!.against}
                    attackLabel="ATK"
                    defenseLabel="DEF"
                  />
                  <MatchupSection
                    title={`${props.awayName} Attack`}
                    subtitle={`vs ${props.homeName} Defense`}
                    attackMetrics={awayMetricsQuery.data!.for}
                    defenseMetrics={homeMetricsQuery.data!.against}
                    attackLabel="ATK"
                    defenseLabel="DEF"
                  />
                </div>
              </Match>

              <Match when={viewMode() === "radar"}>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div class="flex flex-col items-center">
                    <div class="text-center mb-2">
                      <h4 class="font-medium">{props.homeName} Attack</h4>
                      <p class="text-sm text-base-content/60">
                        vs {props.awayName} Defense
                      </p>
                    </div>
                    <RadarChart
                      attackLabel={`${props.homeName} ATK`}
                      defenseLabel={`${props.awayName} DEF`}
                      data={buildRadarData(
                        homeMetricsQuery.data!.for,
                        awayMetricsQuery.data!.against,
                      )}
                    />
                  </div>
                  <div class="flex flex-col items-center">
                    <div class="text-center mb-2">
                      <h4 class="font-medium">{props.awayName} Attack</h4>
                      <p class="text-sm text-base-content/60">
                        vs {props.homeName} Defense
                      </p>
                    </div>
                    <RadarChart
                      attackLabel={`${props.awayName} ATK`}
                      defenseLabel={`${props.homeName} DEF`}
                      data={buildRadarData(
                        awayMetricsQuery.data!.for,
                        homeMetricsQuery.data!.against,
                      )}
                    />
                  </div>
                </div>
              </Match>
            </Switch>
          </Match>
        </Switch>
      </div>
    </div>
  );
}
