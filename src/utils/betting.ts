import type { OddsMarket, OddsValue } from "../hooks/use-match-odds";

export function extractLineFromBetName(betName: string): number {
  // Match patterns like "Over 2.5", "Under 3.5", "Home -1.5", "Away +2.25", etc.
  const patterns = [
    /(?:Over|Under|O|U)\s*([0-9]+(?:\.[0-9]+)?)/i,
    /(?:Home|Away)\s*([+-]?[0-9]+(?:\.[0-9]+)?)/i,
    /([+-]?[0-9]+(?:\.[0-9]+)?)/,
  ];

  for (const pattern of patterns) {
    const match = betName.match(pattern);
    if (match && match[1]) {
      const value = parseFloat(match[1]);
      if (!isNaN(value)) {
        return value;
      }
    }
  }

  return 0;
}

export function createBetDescription(marketName: string, valueName: string): string {
  return `${marketName}: ${valueName}`;
}

export interface PopulatedBetData {
  description: string;
  line: number;
  odds: number;
  amount: number;
}

export function populateBetFromOdds(
  market: OddsMarket,
  value: OddsValue,
  currentAmount: number = 0
): PopulatedBetData {
  return {
    description: createBetDescription(market.name, value.name),
    line: extractLineFromBetName(value.name),
    odds: value.odd,
    amount: currentAmount,
  };
}