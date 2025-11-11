import { useQuery } from "@tanstack/solid-query";
import { Accessor } from "solid-js";

export type League = {
	id: number;
	name: string;
	season: number;
};

export type Team = {
	id: number;
	name: string;
	logo: string | null;
};

export type Match = {
	id: number;
	date: string;
	home: Team;
	away: Team;
	home_goals: number;
	away_goals: number;
	league: League;
	status: "NS" | "FT" | string;
	timestamp: number;
	winner_id: number | null;
};

interface LeagueMatchData {
	matches: Match[];
}

export function useMatches(leagueId: Accessor<number | null>) {
	return useQuery(() => ({
		enabled: leagueId() != null,
		queryKey: ["matches", { leagueId: leagueId() }],
		queryFn: async function (): Promise<LeagueMatchData> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/leagues/${leagueId}/matches`,
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		},
	}));
}

export function useMatch(id: number) {
	return useQuery(() => ({
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
	}));
}
