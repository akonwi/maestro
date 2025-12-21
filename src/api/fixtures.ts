import { useQuery } from "@tanstack/solid-query";
import { Accessor } from "solid-js";
import { useAuth } from "~/contexts/auth";

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

export type Fixture = {
	home_goals: number;
	id: number;
	timestamp: number;
	finished: boolean;
	winner_id: number;
	season: number;
	league_id: number;
	away: {
		name: string;
		id: number;
	};
	away_goals: number;
	home: {
		id: number;
		name: string;
	};
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
				`${import.meta.env.VITE_API_BASE_URL}/leagues/${leagueId}/fixtures`,
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		},
	}));
}

export function useFixture(id: number) {
	return useQuery(() => ({
		queryKey: ["matches", { id }],
		queryFn: async function (): Promise<Match> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/fixtures/${id}`,
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return await response.json();
		},
	}));
}

export type UseFixturesOptions = {
	leagueId: number;
	season: number;
	teamId: number;
};

interface ApiFootballFixture {
	fixture: {
		id: number;
		date: string;
		timestamp: number;
		status: {
			short: string;
		};
	};
	league: {
		id: number;
		name: string;
		season: number;
	};
	teams: {
		home: {
			id: number;
			name: string;
			logo: string;
		};
		away: {
			id: number;
			name: string;
			logo: string;
		};
	};
	goals: {
		home: number;
		away: number;
	};
}

export function useFixtures(options: Accessor<UseFixturesOptions>) {
	const auth = useAuth();

	return useQuery(() => ({
		queryKey: ["fixtures", options()],
		queryFn: async function (): Promise<Fixture[]> {
			const leagueId = options().leagueId;
			const season = options().season;
			const teamId = options().teamId;
			const params = new URLSearchParams({
				league_id: leagueId.toString(),
				season: season.toString(),
			});

			const response = await fetch(
				`${
					import.meta.env.VITE_API_BASE_URL
				}/teams/${teamId}/fixtures?${params.toString()}`,
			);
			return await response.json();
		},
	}));
}
