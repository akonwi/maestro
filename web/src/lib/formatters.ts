/**
 * Format American odds with + prefix for positive values
 */
export function formatOdds(odds: number): string {
  if (odds > 0) {
    return `+${odds}`;
  }
  return odds.toString();
}

/**
 * Format a number as USD currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/**
 * Format a decimal as a percentage string
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Calculate total payout for a bet with American odds
 * Positive odds: +200 means bet $100 to win $200
 * Negative odds: -150 means bet $150 to win $100
 */
export function calculatePayout(amount: number, odds: number): number {
  if (odds > 0) {
    return amount + amount * (odds / 100);
  }
  return amount + amount * (100 / Math.abs(odds));
}

/**
 * Calculate profit for a bet (payout minus original amount)
 */
export function calculateProfit(amount: number, odds: number): number {
  return calculatePayout(amount, odds) - amount;
}
