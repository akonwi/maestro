import { useBetOverview } from '../../hooks/use-bet-overview';

export default function BettingStatsComponent() {
  const { data, loading, error } = useBetOverview();
  const stats = data?.overview;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center p-8">
        <div className="alert alert-error">
          <span>Error loading betting stats: {error}</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex justify-center p-8">
        <div className="alert alert-warning">
          <span>No betting data available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Total Bets</div>
        <div className="stat-value text-primary">{stats.bets.length}</div>
        <div className="stat-desc">
          {stats.num_pending > 0 && `${stats.num_pending} pending`}
        </div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Total Wagered</div>
        <div className="stat-value text-secondary">{formatCurrency(stats.total_wagered)}</div>
        <div className="stat-desc">Amount bet</div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Net Profit</div>
        <div className={`stat-value ${stats.net_profit >= 0 ? 'text-success' : 'text-error'}`}>
          {formatCurrency(stats.net_profit)}
        </div>
        <div className="stat-desc">
          {stats.net_profit >= 0 ? 'Profit' : 'Loss'}
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
        <div className="stat-value text-accent">{formatPercentage(stats.win_rate)}</div>
        <div className="stat-desc">
          {stats.bets.length - stats.num_pending} settled bets
        </div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Total Winnings</div>
        <div className="stat-value text-success">{formatCurrency(stats.gross_payout)}</div>
        <div className="stat-desc">Gross winnings</div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Total Losses</div>
        <div className="stat-value text-error">{formatCurrency(stats.gross_loss)}</div>
        <div className="stat-desc">Amount lost</div>
      </div>

      <div className="stat bg-base-100 rounded-box border border-base-300">
        <div className="stat-title">Pending Bets</div>
        <div className="stat-value text-warning">{stats.num_pending}</div>
        <div className="stat-desc">Awaiting results</div>
      </div>
    </div>
  );
}
