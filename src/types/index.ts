export interface League {
	id: string;
	name: string;
	season: number;
}

export interface Team {
	id: number;
	name: string;
	logo: string | null;
}

export interface Match {
	id: number;
	date: string;
	home: Team;
	away: Team;
	home_goals: number;
	away_goals: number;
	league: League;
	status: "NS" | "FT" | string;
	timestamp: number;
	winner_id: number | null;
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
