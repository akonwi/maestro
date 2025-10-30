import BettingStats from "../components/betting/BettingStats";
import BetHistory from "../components/betting/BetHistory";
import { useBetOverview } from "../hooks/use-bet-overview";

export function BettingPerformance() {
  const query = useBetOverview();
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Betting Performance</h1>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4">Overview</h2>
          <BettingStats query={query} />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <BetHistory />
        </section>
      </div>
    </div>
  );
}
