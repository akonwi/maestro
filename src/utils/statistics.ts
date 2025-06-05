import { Match, TeamStatistics } from '../types';

export function calculateTeamStatistics(teamId: string, matches: Match[]): TeamStatistics {
	const teamMatches = matches.filter(match => 
		match.homeId === teamId || match.awayId === teamId
	);

	if (teamMatches.length === 0) {
		return {
			teamId,
			gamesPlayed: 0,
			wins: 0,
			losses: 0,
			draws: 0,
			goalsFor: 0,
			goalsAgainst: 0,
			goalDifference: 0,
			cleanSheets: 0,
			cleanSheetRatio: 0,
			averageGoalsFor: 0,
			averageGoalsAgainst: 0
		};
	}

	let wins = 0;
	let losses = 0;
	let draws = 0;
	let goalsFor = 0;
	let goalsAgainst = 0;
	let cleanSheets = 0;

	teamMatches.forEach(match => {
		const isHome = match.homeId === teamId;
		const teamScore = isHome ? match.homeScore : match.awayScore;
		const opponentScore = isHome ? match.awayScore : match.homeScore;

		goalsFor += teamScore;
		goalsAgainst += opponentScore;

		if (opponentScore === 0) {
			cleanSheets++;
		}

		if (teamScore > opponentScore) {
			wins++;
		} else if (teamScore < opponentScore) {
			losses++;
		} else {
			draws++;
		}
	});

	const gamesPlayed = teamMatches.length;
	const goalDifference = goalsFor - goalsAgainst;
	const cleanSheetRatio = gamesPlayed > 0 ? cleanSheets / gamesPlayed : 0;
	const averageGoalsFor = gamesPlayed > 0 ? goalsFor / gamesPlayed : 0;
	const averageGoalsAgainst = gamesPlayed > 0 ? goalsAgainst / gamesPlayed : 0;

	return {
		teamId,
		gamesPlayed,
		wins,
		losses,
		draws,
		goalsFor,
		goalsAgainst,
		goalDifference,
		cleanSheets,
		cleanSheetRatio,
		averageGoalsFor,
		averageGoalsAgainst
	};
}

export function formatRecord(stats: TeamStatistics): string {
	return `${stats.wins}-${stats.losses}-${stats.draws}`;
}

export function formatGoalRatio(stats: TeamStatistics): string {
	return `${stats.goalsFor}:${stats.goalsAgainst}`;
}

export function formatCleanSheetPercentage(stats: TeamStatistics): string {
	if (stats.gamesPlayed === 0) return '0%';
	return `${Math.round(stats.cleanSheetRatio * 100)}%`;
}

export function formatAverage(value: number): string {
	return value.toFixed(1);
}

export function getFormRating(stats: TeamStatistics): 'excellent' | 'good' | 'average' | 'poor' {
	if (stats.gamesPlayed === 0) return 'average';
	
	const winPercentage = stats.wins / stats.gamesPlayed;
	
	if (winPercentage >= 0.75) return 'excellent';
	if (winPercentage >= 0.6) return 'good';
	if (winPercentage >= 0.4) return 'average';
	return 'poor';
}
