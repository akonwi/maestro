import { useQuery } from "@tanstack/react-query";
import { Match, Team } from "../types";

interface LeagueMatchData {
	teams: Map<number, Team>;
	matches: Match[];
}

export function useMatches(leagueId: number | null) {
	return useQuery({
		enabled: leagueId != null,
		queryKey: ["matches", { leagueId }],
		queryFn: async function (): Promise<LeagueMatchData> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/leagues/${leagueId}/matches`,
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			return {
				matches: data.matches,
				teams: new Map(data.teams.map((t: Team) => [t.id, t])),
			};
		},
	});
}
