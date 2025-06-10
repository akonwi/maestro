import { useLiveQuery } from 'dexie-react-hooks';
import { BettingStats, calculateBettingStats } from '../../services/betService';

export default function BettingStatsComponent() {
  const stats = useLiveQuery(calculateBettingStats);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (!stats) {
    return (
      <div className="flex justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Total Bets</div>
        <div className="stat-value text-primary">{stats.totalBets}</div>
        <div className="stat-desc">
          {stats.pendingBets > 0 && `${stats.pendingBets} pending`}
        </div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Total Wagered</div>
        <div className="stat-value text-secondary">{formatCurrency(stats.totalWagered)}</div>
        <div className="stat-desc">Amount bet</div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Net Profit</div>
        <div className={`stat-value ${stats.netProfit >= 0 ? 'text-success' : 'text-error'}`}>
          {formatCurrency(stats.netProfit)}
        </div>
        <div className="stat-desc">
          {stats.netProfit >= 0 ? 'Profit' : 'Loss'}
        </div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">ROI</div>
        <div className={`stat-value ${stats.roi >= 0 ? 'text-success' : 'text-error'}`}>
          {formatPercentage(stats.roi)}
        </div>
        <div className="stat-desc">Return on investment</div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Win Rate</div>
        <div className="stat-value text-accent">{formatPercentage(stats.winRate)}</div>
        <div className="stat-desc">
          {stats.totalBets - stats.pendingBets} settled bets
        </div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Total Winnings</div>
        <div className="stat-value text-success">{formatCurrency(stats.totalWinnings)}</div>
        <div className="stat-desc">Gross winnings</div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Total Losses</div>
        <div className="stat-value text-error">{formatCurrency(stats.totalLosses)}</div>
        <div className="stat-desc">Amount lost</div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Pending Bets</div>
        <div className="stat-value text-warning">{stats.pendingBets}</div>
        <div className="stat-desc">Awaiting results</div>
      </div>
    </div>
  );
}
