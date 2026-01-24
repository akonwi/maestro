import { useQuery } from "@tanstack/solid-query";
import { Accessor } from "solid-js";

export interface JuiceFixture {
  fixture: {
    id: number;
    timestamp: number;
    league: {
      id: number;
      name: string;
    };
    home: {
      id: number;
      name: string;
    };
    away: {
      id: number;
      name: string;
    };
  };
  stats: Array<{
    id: number;
    name: string;
    values: Array<{
      name: string;
      odd: number;
      ev_percentage: number;
      true_win_prob: number;
      implied_prob: number;
      edge: number;
    }>;
  }>;
}

export function useJuice(date: Accessor<string>) {
  return useQuery(() => ({
    queryKey: ["juice", date()],
    queryFn: async (): Promise<JuiceFixture[]> => {
      const url = date
        ? `${import.meta.env.VITE_API_BASE_URL}/juice?date=${date()}`
        : `${import.meta.env.VITE_API_BASE_URL}/juice`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch value bets");
      }
      return response.json();
    },
    select: data =>
      data.sort((a, b) => {
        // First sort by timestamp
        if (a.fixture.timestamp !== b.fixture.timestamp) {
          return a.fixture.timestamp - b.fixture.timestamp;
        }
        // If timestamps are equal, sort by fixture ID for stability
        return a.fixture.id - b.fixture.id;
      }),
  }));
}
