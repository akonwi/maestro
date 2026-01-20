import type { Fixture } from "./fixtures";

export type TeamPerformance = {
  league: {
    id: number;
    name: string;
    hidden: boolean;
    following: boolean;
  };
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

export type PerformanceParams = {
  id: number;
  league: number;
  season: number;
};

export const performanceQueryOptions = (params: PerformanceParams) => ({
  queryKey: ["teams", params, "performance"] as const,
  queryFn: async (): Promise<TeamPerformance> => {
    const searchParams = new URLSearchParams({
      league_id: params.league.toString(),
      season: params.season.toString(),
    });
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/teams/${params.id}/performance?${searchParams.toString()}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch team statistics: ${response.status}`);
    }

    return response.json();
  },
});
