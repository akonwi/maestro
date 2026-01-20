import { For } from "solid-js";
import type { TeamStats } from "~/api/analysis";

interface StatsTableProps {
  home: TeamStats;
  away: TeamStats;
  homeName: string;
  awayName: string;
}

const getGamesPlayed = (stats: TeamStats) =>
  stats.wins + stats.losses + stats.draws;

const formatRecord = (stats: TeamStats) =>
  `${stats.wins}-${stats.draws}-${stats.losses}`;

const formatGoals = (stats: TeamStats) => {
  const diff =
    stats.goals_diff > 0 ? `+${stats.goals_diff}` : `${stats.goals_diff}`;
  return `${stats.goals_for}:${stats.goals_against} (${diff})`;
};

const formatPercentage = (count: number, total: number) =>
  total > 0 ? `${Math.round((count / total) * 100)}%` : "0%";

const formatDecimal = (value: number | null | undefined, decimals = 2) =>
  typeof value === "number" ? value.toFixed(decimals) : "-";

export function StatsTable(props: StatsTableProps) {
  const rows = () => {
    const homeGames = getGamesPlayed(props.home);
    const awayGames = getGamesPlayed(props.away);

    return [
      {
        label: "Record (W-D-L)",
        home: formatRecord(props.home),
        away: formatRecord(props.away),
      },
      {
        label: "Goals (GF:GA)",
        home: formatGoals(props.home),
        away: formatGoals(props.away),
      },
      {
        label: "xGF",
        home: formatDecimal(props.home.xgf),
        away: formatDecimal(props.away.xgf),
      },
      {
        label: "xGA",
        home: formatDecimal(props.home.xga),
        away: formatDecimal(props.away.xga),
      },
      {
        label: "Strike Rate",
        home: formatDecimal(props.home.strike_rate, 1),
        away: formatDecimal(props.away.strike_rate, 1),
      },
      {
        label: "Clean Sheets",
        home: `${props.home.cleansheets} (${formatPercentage(props.home.cleansheets, homeGames)})`,
        away: `${props.away.cleansheets} (${formatPercentage(props.away.cleansheets, awayGames)})`,
      },
      {
        label: "+1.5 Goals For",
        home: `${props.home.one_plus_scored} (${formatPercentage(props.home.one_plus_scored, homeGames)})`,
        away: `${props.away.one_plus_scored} (${formatPercentage(props.away.one_plus_scored, awayGames)})`,
      },
      {
        label: "+1.5 Goals Against",
        home: `${props.home.two_plus_conceded} (${formatPercentage(props.home.two_plus_conceded, homeGames)})`,
        away: `${props.away.two_plus_conceded} (${formatPercentage(props.away.two_plus_conceded, awayGames)})`,
      },
    ];
  };

  return (
    <div class="overflow-x-auto">
      <table class="table table-zebra w-full">
        <thead>
          <tr>
            <th>Stat</th>
            <th class="text-center">{props.homeName}</th>
            <th class="text-center">{props.awayName}</th>
          </tr>
        </thead>
        <tbody>
          <For each={rows()}>
            {row => (
              <tr>
                <td class="font-medium">{row.label}</td>
                <td class="text-center">{row.home}</td>
                <td class="text-center">{row.away}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
