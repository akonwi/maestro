import { db } from "../utils/database";

// Bet types and interfaces
export interface Bet {
  id: string;
  matchId: string;
  description: string;
  line: number;
  odds: number;
  amount: number;
  result?: 'win' | 'loss' | 'push';
  createdAt: Date;
}

export interface BettingStats {
  totalBets: number;
  totalWagered: number;
  totalWinnings: number;
  totalLosses: number;
  netProfit: number;
  roi: number;
  winRate: number;
  pendingBets: number;
}

// Bet validation
export const validateBet = (bet: Omit<Bet, 'id' | 'createdAt'>): string[] => {
  const errors: string[] = [];
  
  if (!bet.matchId) errors.push('Match is required');
  if (!bet.description.trim()) errors.push('Description is required');
  if (bet.odds === 0) errors.push('Odds cannot be zero');
  if (bet.odds > -100 && bet.odds < 100 && bet.odds !== 0) errors.push('Odds must be +100 or greater, or -100 or less');
  if (bet.amount <= 0) errors.push('Amount must be positive');
  
  return errors;
};

// CRUD operations
export const createBet = async (betData: Omit<Bet, 'id' | 'createdAt'>): Promise<Bet> => {
  const errors = validateBet(betData);
  if (errors.length > 0) {
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }

  const bet: Bet = {
    ...betData,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };

  await db.bets.add(bet);
  return bet;
};

export const getBet = async (id: string): Promise<Bet | undefined> => {
  return await db.bets.get(id);
};

export const getBetsByMatch = async (matchId: string): Promise<Bet[]> => {
  return await db.bets.where('matchId').equals(matchId).toArray();
};

export const getAllBets = async (): Promise<Bet[]> => {
  return await db.bets.orderBy('createdAt').reverse().toArray();
};

export const updateBet = async (id: string, updates: Partial<Omit<Bet, 'id' | 'createdAt'>>): Promise<void> => {
  await db.bets.update(id, updates);
};

export const deleteBet = async (id: string): Promise<void> => {
  await db.bets.delete(id);
};

// Bet calculations (American odds format)
export const calculatePayout = (amount: number, odds: number): number => {
  if (odds > 0) {
    // Positive odds: +200 means bet $100 to win $200
    return amount + (amount * (odds / 100));
  } else {
    // Negative odds: -150 means bet $150 to win $100
    return amount + (amount * (100 / Math.abs(odds)));
  }
};

export const calculateProfit = (amount: number, odds: number): number => {
  return calculatePayout(amount, odds) - amount;
};

export const calculateLoss = (amount: number): number => {
  return -amount;
};

export const calculateBettingStats = async (): Promise<BettingStats> => {
  const bets = await getAllBets();
  
  const totalBets = bets.length;
  const totalWagered = bets.reduce((sum, bet) => sum + bet.amount, 0);
  
  let totalWinnings = 0;
  let totalLosses = 0;
  let wins = 0;
  let pendingBets = 0;
  
  bets.forEach(bet => {
    if (bet.result === 'win') {
      totalWinnings += calculatePayout(bet.amount, bet.odds);
      wins++;
    } else if (bet.result === 'loss') {
      totalLosses += bet.amount;
    } else if (bet.result === 'push') {
      // Push returns original wager
    } else {
      pendingBets++;
    }
  });
  
  const netProfit = totalWinnings - totalLosses;
  const roi = totalWagered > 0 ? (netProfit / totalWagered) * 100 : 0;
  const winRate = (totalBets - pendingBets) > 0 ? (wins / (totalBets - pendingBets)) * 100 : 0;
  
  return {
    totalBets,
    totalWagered,
    totalWinnings,
    totalLosses,
    netProfit,
    roi,
    winRate,
    pendingBets,
  };
};

// Filter and search utilities
export const filterBetsByDateRange = async (startDate: Date, endDate: Date): Promise<Bet[]> => {
  return await db.bets
    .where('createdAt')
    .between(startDate, endDate, true, true)
    .toArray();
};

export const filterBetsByResult = async (result: 'win' | 'loss' | 'push' | 'pending'): Promise<Bet[]> => {
  if (result === 'pending') {
    return await db.bets.filter(bet => bet.result === undefined).toArray();
  }
  return await db.bets.where('result').equals(result).toArray();
};
