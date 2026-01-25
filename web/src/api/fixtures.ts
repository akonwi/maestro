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

export type LeagueFixtures = {
  id: number;
  name: string;
  fixtures: Fixture[];
};

// Response is a map of league ID -> fixtures array
type FixturesTodayResponse = Record<string, Fixture[]>;

export const fixturesTodayQueryOptions = (date: string) => ({
  queryKey: ["fixtures", "today", date] as const,
  queryFn: async (): Promise<LeagueFixtures[]> => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/fixtures?date=${date}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch fixtures: ${response.status}`);
    }

    const data: FixturesTodayResponse = await response.json();

    // Transform map into array of LeagueFixtures
    return Object.entries(data).map(([leagueId, fixtures]) => ({
      id: Number(leagueId),
      name: fixtures[0]?.league.name ?? "Unknown League",
      fixtures: fixtures.sort((a, b) => a.timestamp - b.timestamp),
    }));
  },
});

// Odds types
export type OddsLine = {
  name: string;
  odd: number;
};

export type OddsStat = {
  id: number;
  name: string;
  values: OddsLine[];
};

export const fixtureOddsQueryOptions = (fixtureId: number) => ({
  queryKey: ["fixtures", fixtureId, "odds"] as const,
  queryFn: async (): Promise<OddsStat[]> => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/fixtures/${fixtureId}/odds`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch odds: ${response.status}`);
    }

    return response.json();
  },
});
