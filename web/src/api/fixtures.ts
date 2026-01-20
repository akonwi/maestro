import type { League } from "./leagues";

export type Team = {
  id: number;
  name: string;
};

export type Fixture = {
  home_goals: number;
  id: number;
  timestamp: number;
  finished: boolean;
  winner_id: number | null;
  season: number;
  league: Omit<League, "hidden">;
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

export const fixtureQueryOptions = (id: number) => ({
  queryKey: ["matches", { id }] as const,
  queryFn: async (): Promise<Fixture> => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/fixtures/${id}`,
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
});

export type UseFixturesOptions = {
  leagueId: number;
  season: number;
  teamId: number;
};

export const fixturesQueryOptions = (options: UseFixturesOptions) => ({
  queryKey: ["fixtures", options] as const,
  queryFn: async (): Promise<Fixture[]> => {
    const params = new URLSearchParams({
      league_id: options.leagueId.toString(),
      season: options.season.toString(),
    });

    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/teams/${options.teamId}/fixtures?${params.toString()}`,
    );
    return response.json();
  },
});

export type MatchupForm = {
  home: Fixture[];
  away: Fixture[];
};

export const matchupFormQueryOptions = (fixtureId: number) => ({
  queryKey: ["matchup", { fixtureId }, "form"] as const,
  queryFn: async (): Promise<MatchupForm> => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/matchup/${fixtureId}/form`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch matchup form: ${response.status}`);
    }

    return response.json();
  },
});
