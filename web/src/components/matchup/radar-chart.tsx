import { createMemo, For } from "solid-js";

interface RadarChartProps {
  attackLabel: string;
  defenseLabel: string;
  data: {
    label: string;
    attack: number;
    defense: number;
  }[];
}

export function RadarChart(props: RadarChartProps) {
  const size = 280;
  const center = size / 2;
  const radius = 100;
  const levels = 4;

  // Find max value for scaling
  const maxValue = createMemo(() => {
    let max = 0;
    for (const d of props.data) {
      max = Math.max(max, d.attack, d.defense);
    }
    return max * 1.1; // Add 10% padding
  });

  // Calculate point position on the radar
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / props.data.length - Math.PI / 2;
    const scaledRadius = (value / maxValue()) * radius;
    return {
      x: center + scaledRadius * Math.cos(angle),
      y: center + scaledRadius * Math.sin(angle),
    };
  };

  // Get label position (slightly outside the chart)
  const getLabelPosition = (index: number) => {
    const angle = (Math.PI * 2 * index) / props.data.length - Math.PI / 2;
    const labelRadius = radius + 24;
    return {
      x: center + labelRadius * Math.cos(angle),
      y: center + labelRadius * Math.sin(angle),
    };
  };

  // Generate polygon points string
  const getPolygonPoints = (values: number[]) => {
    return values
      .map((value, index) => {
        const point = getPoint(index, value);
        return `${point.x},${point.y}`;
      })
      .join(" ");
  };

  // Generate grid polygon at a given level
  const getGridPolygon = (level: number) => {
    const levelRadius = (radius * level) / levels;
    const points = [];
    for (let i = 0; i < props.data.length; i++) {
      const angle = (Math.PI * 2 * i) / props.data.length - Math.PI / 2;
      points.push({
        x: center + levelRadius * Math.cos(angle),
        y: center + levelRadius * Math.sin(angle),
      });
    }
    return points.map(p => `${p.x},${p.y}`).join(" ");
  };

  const attackPoints = createMemo(() =>
    getPolygonPoints(props.data.map(d => d.attack)),
  );

  const defensePoints = createMemo(() =>
    getPolygonPoints(props.data.map(d => d.defense)),
  );

  return (
    <div class="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        class="overflow-visible"
      >
        {/* Grid levels */}
        <For each={[1, 2, 3, 4]}>
          {level => (
            <polygon
              points={getGridPolygon(level)}
              fill="none"
              stroke="currentColor"
              stroke-width="1"
              class="text-base-300"
            />
          )}
        </For>

        {/* Axis lines */}
        <For each={props.data}>
          {(_, index) => {
            const endPoint = getPoint(index(), maxValue());
            return (
              <line
                x1={center}
                y1={center}
                x2={endPoint.x}
                y2={endPoint.y}
                stroke="currentColor"
                stroke-width="1"
                class="text-base-300"
              />
            );
          }}
        </For>

        {/* Defense polygon (behind) */}
        <polygon
          points={defensePoints()}
          class="fill-secondary/30 stroke-secondary"
          stroke-width="2"
        />

        {/* Attack polygon (front) */}
        <polygon
          points={attackPoints()}
          class="fill-primary/30 stroke-primary"
          stroke-width="2"
        />

        {/* Data points - Defense */}
        <For each={props.data}>
          {(d, index) => {
            const point = getPoint(index(), d.defense);
            return (
              <circle cx={point.x} cy={point.y} r="4" class="fill-secondary" />
            );
          }}
        </For>

        {/* Data points - Attack */}
        <For each={props.data}>
          {(d, index) => {
            const point = getPoint(index(), d.attack);
            return (
              <circle cx={point.x} cy={point.y} r="4" class="fill-primary" />
            );
          }}
        </For>

        {/* Labels */}
        <For each={props.data}>
          {(d, index) => {
            const pos = getLabelPosition(index());
            const dataCount = props.data.length;
            const i = index();

            // Determine text anchor based on position
            let textAnchor: "start" | "middle" | "end" = "middle";
            if (i > 0 && i < dataCount / 2) textAnchor = "start";
            if (i > dataCount / 2) textAnchor = "end";

            return (
              <text
                x={pos.x}
                y={pos.y}
                text-anchor={textAnchor}
                dominant-baseline="middle"
                class="text-xs fill-base-content/70"
              >
                {d.label}
              </text>
            );
          }}
        </For>
      </svg>

      {/* Legend */}
      <div class="flex gap-6 mt-4">
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded bg-primary/60" />
          <span class="text-sm">{props.attackLabel}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="w-4 h-4 rounded bg-secondary/60" />
          <span class="text-sm">{props.defenseLabel}</span>
        </div>
      </div>
    </div>
  );
}
