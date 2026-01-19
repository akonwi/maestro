interface ComparisonBarProps {
  label: string;
  homeValue: number;
  awayValue: number;
  homeName: string;
  awayName: string;
  inverse?: boolean;
  formatValue?: (v: number) => string;
}

export function ComparisonBar(props: ComparisonBarProps) {
  const format = () => props.formatValue ?? ((v: number) => v.toFixed(2));

  const total = () => props.homeValue + props.awayValue;
  const homePercent = () =>
    total() > 0 ? (props.homeValue / total()) * 100 : 50;
  const awayPercent = () =>
    total() > 0 ? (props.awayValue / total()) * 100 : 50;

  const homeLeads = () =>
    props.inverse
      ? props.homeValue < props.awayValue
      : props.homeValue > props.awayValue;

  const awayLeads = () =>
    props.inverse
      ? props.awayValue < props.homeValue
      : props.awayValue > props.homeValue;

  return (
    <div class="space-y-1">
      <div class="flex justify-between text-sm">
        <span
          classList={{
            "font-bold text-primary": homeLeads(),
            "text-base-content/70": !homeLeads(),
          }}
        >
          {props.homeName}: {format()(props.homeValue)}
        </span>
        <span class="text-base-content/60">{props.label}</span>
        <span
          classList={{
            "font-bold text-secondary": awayLeads(),
            "text-base-content/70": !awayLeads(),
          }}
        >
          {props.awayName}: {format()(props.awayValue)}
        </span>
      </div>

      <div class="flex h-4 rounded overflow-hidden">
        <div
          classList={{
            "bg-primary": homeLeads(),
            "bg-primary/30": !homeLeads(),
          }}
          style={{ width: `${homePercent()}%` }}
        />
        <div
          classList={{
            "bg-secondary": awayLeads(),
            "bg-secondary/30": !awayLeads(),
          }}
          style={{ width: `${awayPercent()}%` }}
        />
      </div>
    </div>
  );
}
