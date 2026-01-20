import { For } from "solid-js";
import type { Fixture } from "~/api/fixtures";

interface FormTimelineProps {
  fixtures: Fixture[];
  teamId: number;
}

export function FormTimeline(props: FormTimelineProps) {
  const getResult = (fixture: Fixture): "W" | "D" | "L" => {
    if (fixture.winner_id === props.teamId) return "W";
    if (fixture.winner_id === null) return "D";
    return "L";
  };

  const getTooltip = (fixture: Fixture) => {
    const isHome = fixture.home.id === props.teamId;
    const opponent = isHome ? fixture.away.name : fixture.home.name;
    const score = `${fixture.home_goals}-${fixture.away_goals}`;
    return `${isHome ? "vs" : "at"} ${opponent} (${score})`;
  };

  return (
    <div class="flex gap-2 overflow-x-auto w-full">
      <For each={props.fixtures}>
        {(fixture) => {
          const result = getResult(fixture);
          return (
            <div
              classList={{
                "badge-warning": result === "D",
                "badge-success": result === "W",
                "badge-error": result === "L",
              }}
              class="badge badge-lg shrink-0"
              title={getTooltip(fixture)}
            >
              {result}
            </div>
          );
        }}
      </For>
    </div>
  );
}
