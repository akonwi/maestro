import { useQuery } from "@tanstack/react-query";
import { Match } from "../types";

interface LeagueMatchData {
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

			return await response.json();
		},
	});
}

export function useMatch(id: number) {
	return useQuery({
		queryKey: ["matches", { id }],
		queryFn: async function (): Promise<Match> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/matches/${id}`,
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		},
	});
}
