export interface League {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  leagueId: string;
  createdAt: Date;
}

export interface Match {
  id: string;
  date: string;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  leagueId: string;
  createdAt: Date;
}

export interface TeamStatistics {
  teamId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  cleanSheets: number;
  cleanSheetRatio: number;
  averageGoalsFor: number;
  averageGoalsAgainst: number;
}
