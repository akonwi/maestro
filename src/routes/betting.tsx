import { Suspense } from "solid-js";
import { BetTable } from "~/components/bet-table";
import { BettingStats } from "~/components/betting-stats";

export default function BettingPerformance() {
  return (
    <div class="space-y-8">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold">Betting Performance</h1>
      </div>

      <Suspense
        fallback={
          <div class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
          </div>
        }
      >
        <div class="space-y-8">
          <section>
            <h2 class="text-xl font-semibold mb-4">Overview</h2>
            <BettingStats />
          </section>

          <section>
            <h2 class="text-xl font-semibold mb-4">Recent Activity</h2>
            <BetTable />
          </section>
        </div>
      </Suspense>
    </div>
  );
}
