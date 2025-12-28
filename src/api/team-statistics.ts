import { useQuery } from "@tanstack/solid-query";
import { Fixture } from "./fixtures";
import { Accessor } from "solid-js";

export type TeamStatisticsResponse = {
	response: {
		league: {
			id: number;
			name: string;
			country: string;
			logo: string;
			flag: string;
			season: number;
		};
	};
};

export function useTeamStatistics(
	teamId: number,
	league: number,
	season: number,
) {
	return useQuery<TeamStatisticsResponse>(() => ({
		queryKey: ["team-statistics", { teamId, league, season }],
		queryFn: async () => {
			const token = localStorage.getItem("maestro_api_token");
			if (!token) {
				throw new Error("No API token found");
			}

			const response = await fetch(
				`https://v3.football.api-sports.io/teams/statistics?league=${league}&season=${season}&team=${teamId}`,
				{
					headers: {
						"x-rapidapi-key": token,
					},
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch team statistics: ${response.status}`);
			}

			return response.json();
		},
		enabled: !!teamId && !!league && !!season,
	}));
}

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

export function getPerformance(
	params: Accessor<{
		id: number;
		league: number;
		season: number;
	}>,
) {
	const _params = params();
	return () => ({
		queryKey: ["teams", _params, "performance"],
		queryFn: async function (): Promise<TeamPerformance> {
			const searchParams = new URLSearchParams({
				league_id: _params.league.toString(),
				season: _params.season.toString(),
			});
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/teams/${
					_params.id
				}/performance?${searchParams.toString()}`,
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch team statistics: ${response.status}`);
			}

			return response.json();
		},
	});
}
