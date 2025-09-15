import { useSuspenseQuery } from "@tanstack/react-query";

interface PredictionData {
	winner: {
		id: number;
		name: string;
		comment: string | null;
	};
	win_or_draw: boolean;
	home_goals: string;
	away_goals: string;
	advice: string;
}

export interface AnalysisData {
	prediction: PredictionData;
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
