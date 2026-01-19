import { For } from "solid-js";
import type { TeamStats } from "~/api/analysis";

interface FormTimelineProps {
  stats: TeamStats;
}

export function FormTimeline(props: FormTimelineProps) {
  const results = () => {
    const blocks: Array<{ result: "W" | "D" | "L"; tooltip: string }> = [];
    for (let i = 0; i < props.stats.wins; i++)
      blocks.push({ result: "W", tooltip: "Win" });
    for (let i = 0; i < props.stats.draws; i++)
      blocks.push({ result: "D", tooltip: "Draw" });
    for (let i = 0; i < props.stats.losses; i++)
      blocks.push({ result: "L", tooltip: "Loss" });
    return blocks;
  };

  return (
    <div class="flex gap-1 overflow-x-auto w-full pb-1">
      <For each={results()}>
        {(item) => (
          <div
            classList={{
              "badge-success": item.result === "W",
              "badge-warning": item.result === "D",
              "badge-error": item.result === "L",
            }}
            class="badge badge-lg tooltip flex-shrink-0"
            data-tip={item.tooltip}
          >
            {item.result}
          </div>
        )}
      </For>
    </div>
  );
}
