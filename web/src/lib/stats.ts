import type { Fixture } from "~/api/fixtures";

export type ComputedStats = {
  played: { home: number; away: number; total: number };
  wins: { home: number; away: number; total: number };
  draws: { home: number; away: number; total: number };
  losses: { home: number; away: number; total: number };
  goalsFor: { home: number; away: number; total: number };
  goalsAgainst: { home: number; away: number; total: number };
  cleansheets: { home: number; away: number; total: number };
  failedToScore: { home: number; away: number; total: number };
};

export function computeStatsFromFixtures(
  fixtures: Fixture[],
  teamId: number,
): ComputedStats {
  const stats: ComputedStats = {
    played: { home: 0, away: 0, total: 0 },
    wins: { home: 0, away: 0, total: 0 },
    draws: { home: 0, away: 0, total: 0 },
    losses: { home: 0, away: 0, total: 0 },
    goalsFor: { home: 0, away: 0, total: 0 },
    goalsAgainst: { home: 0, away: 0, total: 0 },
    cleansheets: { home: 0, away: 0, total: 0 },
    failedToScore: { home: 0, away: 0, total: 0 },
  };

  for (const f of fixtures) {
    const isHome = f.home.id === teamId;
    const loc = isHome ? "home" : "away";
    const teamGoals = isHome ? f.home_goals : f.away_goals;
    const oppGoals = isHome ? f.away_goals : f.home_goals;

    stats.played[loc]++;
    stats.played.total++;
    stats.goalsFor[loc] += teamGoals;
    stats.goalsFor.total += teamGoals;
    stats.goalsAgainst[loc] += oppGoals;
    stats.goalsAgainst.total += oppGoals;

    if (oppGoals === 0) {
      stats.cleansheets[loc]++;
      stats.cleansheets.total++;
    }
    if (teamGoals === 0) {
      stats.failedToScore[loc]++;
      stats.failedToScore.total++;
    }

    if (f.winner_id === teamId) {
      stats.wins[loc]++;
      stats.wins.total++;
    } else if (f.winner_id === null) {
      stats.draws[loc]++;
      stats.draws.total++;
    } else {
      stats.losses[loc]++;
      stats.losses.total++;
    }
  }

  return stats;
}
