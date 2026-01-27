import { Match, Show, Switch } from "solid-js";
import type { TeamMetrics } from "~/api/analysis";

interface CornerAnalysisProps {
  homeName: string;
  awayName: string;
  homeMetrics: TeamMetrics | undefined;
  awayMetrics: TeamMetrics | undefined;
  isPending: boolean;
  hasError: boolean;
  view: "form" | "season";
  onViewChange: (view: "form" | "season") => void;
}

interface ComparisonBarProps {
  label: string;
  homeValue: number;
  awayValue: number;
  homeName: string;
  awayName: string;
  /** If true, lower value is better (e.g., corners conceded) */
  lowerIsBetter?: boolean;
}

function ComparisonBar(props: ComparisonBarProps) {
  const total = () => props.homeValue + props.awayValue;
  const homePercent = () =>
    total() > 0 ? (props.homeValue / total()) * 100 : 50;
  const awayPercent = () =>
    total() > 0 ? (props.awayValue / total()) * 100 : 50;

  const homeWins = () =>
    props.lowerIsBetter
      ? props.homeValue < props.awayValue
      : props.homeValue > props.awayValue;

  return (
    <div class="space-y-2">
      <div class="text-sm font-medium text-center">{props.label}</div>
      <div class="flex items-center gap-2">
        <span class="text-sm w-20 md:w-24 text-right truncate">
          {props.homeName}
        </span>
        <div class="flex-1 flex h-6 rounded-lg overflow-hidden bg-base-200">
          <div
            class={`flex items-center justify-end pr-2 text-xs font-medium transition-all ${
              homeWins() ? "bg-primary text-primary-content" : "bg-base-300"
            }`}
            style={{ width: `${homePercent()}%` }}
          >
            {props.homeValue.toFixed(1)}
          </div>
          <div
            class={`flex items-center justify-start pl-2 text-xs font-medium transition-all ${
              !homeWins()
                ? "bg-secondary text-secondary-content"
                : "bg-base-300"
            }`}
            style={{ width: `${awayPercent()}%` }}
          >
            {props.awayValue.toFixed(1)}
          </div>
        </div>
        <span class="text-sm w-20 md:w-24 truncate">{props.awayName}</span>
      </div>
    </div>
  );
}

function NetCornerBadge(props: { name: string; net: number }) {
  const isPositive = () => props.net > 0;
  const isNegative = () => props.net < 0;

  return (
    <div class="flex flex-col items-center gap-1">
      <span class="text-xs text-base-content/60 truncate max-w-20 md:max-w-none">
        {props.name}
      </span>
      <span
        class={`badge ${
          isPositive()
            ? "badge-success"
            : isNegative()
              ? "badge-error"
              : "badge-neutral"
        }`}
      >
        {isPositive() ? "+" : ""}
        {props.net.toFixed(1)} net
      </span>
    </div>
  );
}

function generateInsight(
  homeName: string,
  awayName: string,
  homeFor: number,
  homeAgainst: number,
  awayFor: number,
  awayAgainst: number,
): string {
  const homeNet = homeFor - homeAgainst;
  const awayNet = awayFor - awayAgainst;

  const homeDominant = homeFor > awayFor && homeNet > awayNet;
  const awayDominant = awayFor > homeFor && awayNet > homeNet;

  if (homeDominant) {
    return `${homeName} dominates corners (${homeFor.toFixed(1)} won/game, ${homeNet > 0 ? "+" : ""}${homeNet.toFixed(1)} net)`;
  }
  if (awayDominant) {
    return `${awayName} dominates corners (${awayFor.toFixed(1)} won/game, ${awayNet > 0 ? "+" : ""}${awayNet.toFixed(1)} net)`;
  }
  return "Evenly matched in corners";
}

export function CornerAnalysis(props: CornerAnalysisProps) {
  const hasData = () => props.homeMetrics && props.awayMetrics;

  const homeFor = () => props.homeMetrics?.for.perGame.corners ?? 0;
  const homeAgainst = () => props.homeMetrics?.against.perGame.corners ?? 0;
  const awayFor = () => props.awayMetrics?.for.perGame.corners ?? 0;
  const awayAgainst = () => props.awayMetrics?.against.perGame.corners ?? 0;

  const homeNet = () => homeFor() - homeAgainst();
  const awayNet = () => awayFor() - awayAgainst();

  const gamesLabel = () => {
    if (!props.homeMetrics || !props.awayMetrics) return "";
    const homeGames = props.homeMetrics.num_fixtures;
    const awayGames = props.awayMetrics.num_fixtures;
    if (homeGames === awayGames) {
      return `Based on ${homeGames} games each`;
    }
    return `Based on ${homeGames} / ${awayGames} games`;
  };

  return (
    <div class="card bg-base-100 border border-base-300">
      <div class="card-body">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold">Corner Analysis</h3>
          <div class="tabs tabs-boxed tabs-sm">
            <button
              type="button"
              class={`tab ${props.view === "form" ? "tab-active" : ""}`}
              onClick={() => props.onViewChange("form")}
            >
              Form (5)
            </button>
            <button
              type="button"
              class={`tab ${props.view === "season" ? "tab-active" : ""}`}
              onClick={() => props.onViewChange("season")}
            >
              Season
            </button>
          </div>
        </div>

        <Switch>
          <Match when={props.isPending}>
            <div class="flex flex-col gap-4">
              <div class="skeleton h-4 w-32 mx-auto" />
              <div class="skeleton h-6 w-full" />
              <div class="skeleton h-4 w-32 mx-auto" />
              <div class="skeleton h-6 w-full" />
            </div>
          </Match>

          <Match when={props.hasError}>
            <div class="alert alert-error">
              <span>Failed to load corner data</span>
            </div>
          </Match>

          <Match when={hasData()}>
            <div class="space-y-4">
              <ComparisonBar
                label="Corners Won (per game)"
                homeValue={homeFor()}
                awayValue={awayFor()}
                homeName={props.homeName}
                awayName={props.awayName}
              />

              <ComparisonBar
                label="Corners Conceded (per game)"
                homeValue={homeAgainst()}
                awayValue={awayAgainst()}
                homeName={props.homeName}
                awayName={props.awayName}
                lowerIsBetter
              />

              <div class="flex justify-center gap-8 pt-2">
                <NetCornerBadge name={props.homeName} net={homeNet()} />
                <NetCornerBadge name={props.awayName} net={awayNet()} />
              </div>

              <Show when={gamesLabel()}>
                <p class="text-xs text-base-content/50 text-center">
                  {gamesLabel()}
                </p>
              </Show>

              <div class="alert">
                <span class="text-sm">
                  {generateInsight(
                    props.homeName,
                    props.awayName,
                    homeFor(),
                    homeAgainst(),
                    awayFor(),
                    awayAgainst(),
                  )}
                </span>
              </div>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  );
}
