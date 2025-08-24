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
	analysis: {
		match_id: number;
		recommendations: {
			away_goals: number | null;
			total_goals: number | null;
			both_teams_to_score: boolean | null;
			home_goals: number | null;
		};
		home_confidence: {
			score: number;
			xg_advantage: number;
			quality_gap: number;
			def_vuln: number;
			label: string;
		};
		away_confidence: {
			score: number;
			xg_advantage: number;
			quality_gap: number;
			def_vuln: number;
			label: string;
		};
	};
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
