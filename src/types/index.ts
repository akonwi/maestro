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
	id: number;
	date: string;
	home_team_id: number;
	away_team_id: number;
	home_goals: number;
	away_goals: number;
	league_id: number;
	status: "NS" | "FT" | string;
}

export interface TeamStatistics {
	teamId: number;
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
