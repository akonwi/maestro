import { Match, Switch } from "solid-js";
import { useBetOverview } from "~/api/bets";
import { formatCurrency, formatPercentage } from "~/lib/formatters";

export function BettingStats() {
  const query = useBetOverview();
  const totalBetsCount = () => query.data?.bets.length ?? 0;
  const pendingBetsCount = () => query.data?.num_pending ?? 0;
  const totalWagered = () => formatCurrency(query.data?.total_wagered ?? 0);
  const netProfit = () => query.data?.net_profit ?? 0;
  const roi = () => query.data?.roi ?? 0;
  const winRate = () => query.data?.win_rate ?? 0.0;
  const grossWinnings = () => query.data?.gross_payout ?? 0;
  const grossLoss = () => query.data?.gross_loss ?? 0;

  return (
    <Switch>
      <Match when={query.isError}>
        <div class="flex justify-center p-8">
          <div class="alert alert-error">
            <span>Error loading betting stats: {query.error?.message}</span>
          </div>
        </div>
      </Match>

      <Match when={query.data == null}>
        <div class="flex justify-center p-8">
          <div class="alert alert-warning">
            <span>No betting data available</span>
          </div>
        </div>
      </Match>

      <Match when>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="stat bg-base-100 rounded-box border border-base-300">
            <div class="stat-title">Total Bets</div>
            <div class="stat-value text-primary">{totalBetsCount()}</div>
          </div>

          <div class="stat bg-base-100 rounded-box border border-base-300">
            <div class="stat-title">Total Wagered</div>
            <div class="stat-value text-secondary">{totalWagered()}</div>
            <div class="stat-desc">Amount bet</div>
          </div>

          <div class="stat bg-base-100 rounded-box border border-base-300">
            <div class="stat-title">Net Profit</div>
            <div
              classList={{
                "stat-value": true,
                "text-success": netProfit() >= 0,
                "text-error": netProfit() < 0,
              }}
            >
              {formatCurrency(netProfit())}
            </div>
            <div class="stat-desc">{netProfit() >= 0 ? "Profit" : "Loss"}</div>
          </div>

          <div class="stat bg-base-100 rounded-box border border-base-300">
            <div class="stat-title">ROI</div>
            <div
              classList={{
                "stat-value": true,
                "text-success": roi() >= 0,
                "text-error": roi() < 0,
              }}
            >
              {formatPercentage(roi())}
            </div>
            <div class="stat-desc">Return on investment</div>
          </div>

          <div class="stat bg-base-100 rounded-box border border-base-300">
            <div class="stat-title">Win Rate</div>
            <div class="stat-value text-accent">
              {formatPercentage(winRate())}
            </div>
            <div class="stat-desc">
              {totalBetsCount() - pendingBetsCount()} settled bets
            </div>
          </div>

          <div class="stat bg-base-100 rounded-box border border-base-300">
            <div class="stat-title">Total Winnings</div>
            <div class="stat-value text-success">
              {formatCurrency(grossWinnings())}
            </div>
            <div class="stat-desc">Gross winnings</div>
          </div>

          <div class="stat bg-base-100 rounded-box border border-base-300">
            <div class="stat-title">Total Losses</div>
            <div class="stat-value text-error">
              {formatCurrency(grossLoss())}
            </div>
            <div class="stat-desc">Amount lost</div>
          </div>

          <div class="stat bg-base-100 rounded-box border border-base-300">
            <div class="stat-title">Pending Bets</div>
            <div class="stat-value text-warning">{pendingBetsCount()}</div>
            <div class="stat-desc">Awaiting results</div>
          </div>
        </div>
      </Match>
    </Switch>
  );
}
