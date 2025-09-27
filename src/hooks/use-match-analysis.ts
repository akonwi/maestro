import { useSuspenseQuery } from "@tanstack/react-query";

export interface AnalysisData {
	comparison: ComparisonData;
}

interface TeamStats {
	id: number;
	name: string;
	num_games: number;
	wins: number;
	draws: number;
	losses: number;
	goals_for: number;
	one_plus_scored: number;
	strike_rate: number;
	goals_against: number;
	goals_diff: number;
	xgf: number;
	xga: number;
	cleansheets: number;
	one_conceded: number;
	two_plus_conceded: number;
	win_rate: number;
}

interface ComparisonData {
	home: TeamStats;
	away: TeamStats;
}

export function useMatchAnalysis(matchId: number) {
	return useSuspenseQuery<AnalysisData>({
		queryKey: ["analysis", { matchId }],
		queryFn: async () => {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/analysis/${matchId}`,
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch analysis: ${response.status}`);
			}

			return response.json();
		},
	});
}
