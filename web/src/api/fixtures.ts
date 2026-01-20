import { useQuery } from "@tanstack/solid-query";
import { Accessor } from "solid-js";
import { useAuth } from "~/contexts/auth";
import { League } from "./leagues";

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

export function useFixture(id: number) {
  return useQuery(() => ({
    queryKey: ["matches", { id }],
    queryFn: async function (): Promise<Fixture> {
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

export type MatchupForm = {
  home: Fixture[];
  away: Fixture[];
};

export function useMatchupForm(fixtureId: number) {
  return useQuery<MatchupForm>(() => ({
    queryKey: ["matchup", { fixtureId }, "form"],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/matchup/${fixtureId}/form`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch matchup form: ${response.status}`);
      }

      return response.json();
    },
  }));
}
