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
  status: string;
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
export type LineType = "over" | "under" | "exactly" | "home" | "away";

export type OddsLine = {
  name: string;
  odd: number;
  type: LineType;
  value: number | null;
};

export type OddsStat = {
  id: number;
  name: string;
  values: OddsLine[];
};

export type FixtureTeamStats = {
  id: number;
  shots: number;
  shots_on_goal: number;
  shots_off_goal: number;
  shots_blocked: number;
  shots_in_box: number;
  shots_out_box: number;
  corners: number;
  offsides: number;
  possession: number;
  passes: number;
  passes_completed: number;
  xg: number;
  goals_prevented: number;
  fouls: number;
  yellow_cards: number;
  red_cards: number;
};

export type FixtureStats = {
  fixture: Fixture;
  home: FixtureTeamStats;
  away: FixtureTeamStats;
  teams: Team[];
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

export const fixtureStatsQueryOptions = (fixtureId: number) => ({
  queryKey: ["fixtures", fixtureId, "stats"] as const,
  queryFn: async (): Promise<FixtureStats> => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/fixtures/${fixtureId}/stats`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch fixture stats: ${response.status}`);
    }

    return response.json();
  },
});
