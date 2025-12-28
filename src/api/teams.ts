import { useQuery } from "@tanstack/solid-query";
import { URLSearchParams } from "url";
import { Fixture } from "./fixtures";

export type TeamPerformance = {
	fixtures: {
		all: Fixture[];
		played: {
			home: number;
			away: number;
			total: number;
		};
		wins: {
			home: number;
			away: number;
			total: number;
		};
		draws: {
			home: number;
			away: number;
			total: number;
		};
		losses: {
			home: number;
			away: number;
			total: number;
		};
	};
	goals: {
		for: {
			home: number;
			away: number;
			total: number;
		};
		against: {
			home: number;
			away: number;
			total: number;
		};
	};
	cleansheets: {
		home: number;
		away: number;
		total: number;
	};
	failed_to_score: {
		home: number;
		away: number;
		total: number;
	};
};

export function usePerformance(id: number, league: number, season: number) {
	return useQuery<TeamPerformance>(() => ({
		queryKey: ["teams", { id, league, season }, "performance"],
		queryFn: async () => {
			const searchParams = new URLSearchParams({
				league_id: league.toString(),
				season: season.toString(),
			});
			const response = await fetch(
				`${
					import.meta.env.VITE_API_BASE_URL
				}/teams/${id}/performance?${searchParams.toString()}`,
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch team statistics: ${response.status}`);
			}

			return response.json();
		},
	}));
}
