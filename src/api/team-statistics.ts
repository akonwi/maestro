import { useQuery } from "@tanstack/solid-query";

export type TeamStatisticsResponse = {
	get: string;
	parameters: {
		league: string;
		season: string;
		team: string;
	};
	errors: any[];
	results: number;
	paging: {
		current: number;
		total: number;
	};
	response: {
		league: {
			id: number;
			name: string;
			country: string;
			logo: string;
			flag: string;
			season: number;
		};
		team: {
			id: number;
			name: string;
			logo: string;
		};
		form: string;
		fixtures: {
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
			loses: {
				home: number;
				away: number;
				total: number;
			};
		};
		goals: {
			for: {
				total: {
					home: number;
					away: number;
					total: number;
				};
				average: {
					home: string;
					away: string;
					total: string;
				};
				minute: {
					"0-15": { total: number | null; percentage: string | null };
					"16-30": { total: number | null; percentage: string | null };
					"31-45": { total: number | null; percentage: string | null };
					"46-60": { total: number | null; percentage: string | null };
					"61-75": { total: number | null; percentage: string | null };
					"76-90": { total: number | null; percentage: string | null };
					"91-105": { total: number | null; percentage: string | null };
					"106-120": { total: number | null; percentage: string | null };
				};
				under_over: {
					"0.5": { over: number; under: number };
					"1.5": { over: number; under: number };
					"2.5": { over: number; under: number };
					"3.5": { over: number; under: number };
					"4.5": { over: number; under: number };
				};
			};
			against: {
				total: {
					home: number;
					away: number;
					total: number;
				};
				average: {
					home: string;
					away: string;
					total: string;
				};
				minute: {
					"0-15": { total: number | null; percentage: string | null };
					"16-30": { total: number | null; percentage: string | null };
					"31-45": { total: number | null; percentage: string | null };
					"46-60": { total: number | null; percentage: string | null };
					"61-75": { total: number | null; percentage: string | null };
					"76-90": { total: number | null; percentage: string | null };
					"91-105": { total: number | null; percentage: string | null };
					"106-120": { total: number | null; percentage: string | null };
				};
				under_over: {
					"0.5": { over: number; under: number };
					"1.5": { over: number; under: number };
					"2.5": { over: number; under: number };
					"3.5": { over: number; under: number };
					"4.5": { over: number; under: number };
				};
			};
		};
		biggest: {
			streak: {
				wins: number;
				draws: number;
				loses: number;
			};
			wins: {
				home: string;
				away: string;
			};
			loses: {
				home: string;
				away: string;
			};
			goals: {
				for: {
					home: number;
					away: number;
				};
				against: {
					home: number;
					away: number;
				};
			};
		};
		clean_sheet: {
			home: number;
			away: number;
			total: number;
		};
		failed_to_score: {
			home: number;
			away: number;
			total: number;
		};
		penalty: {
			scored: {
				total: number;
				percentage: string;
			};
			missed: {
				total: number;
				percentage: string;
			};
			total: number;
		};
		lineups: Array<{
			formation: string;
			played: number;
		}>;
		cards: {
			yellow: {
				"0-15": { total: number | null; percentage: string | null };
				"16-30": { total: number | null; percentage: string | null };
				"31-45": { total: number | null; percentage: string | null };
				"46-60": { total: number | null; percentage: string | null };
				"61-75": { total: number | null; percentage: string | null };
				"76-90": { total: number | null; percentage: string | null };
				"91-105": { total: number | null; percentage: string | null };
				"106-120": { total: number | null; percentage: string | null };
			};
			red: {
				"0-15": { total: number | null; percentage: string | null };
				"16-30": { total: number | null; percentage: string | null };
				"31-45": { total: number | null; percentage: string | null };
				"46-60": { total: number | null; percentage: string | null };
				"61-75": { total: number | null; percentage: string | null };
				"76-90": { total: number | null; percentage: string | null };
				"91-105": { total: number | null; percentage: string | null };
				"106-120": { total: number | null; percentage: string | null };
			};
		};
	};
};

export function useTeamStatistics(teamId: number, league: number, season: number) {
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
				}
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch team statistics: ${response.status}`);
			}

			return response.json();
		},
		enabled: !!teamId && !!league && !!season,
	}));
}