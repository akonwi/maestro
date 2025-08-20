import { useQuery } from "@tanstack/react-query";

export interface PredictionData {
  winner: {
    id: number;
    name: string;
    comment: string;
  };
  win_or_draw: boolean;
  home_goals: string;
  away_goals: string;
  advice: string;
}

export function useMatchPredictions(matchId: number) {
  return useQuery<PredictionData>({
    queryKey: ["predictions", { matchId }],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/predictions/${matchId}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch predictions: ${response.status}`);
      }

      return response.json();
    },
    enabled: !!matchId, // Only run query if matchId is provided
  });
}