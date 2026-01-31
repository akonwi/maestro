import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { useAuth } from "~/contexts/auth";

export interface Bet {
  id: number;
  match_id: number;
  name: string;
  line: number;
  odds: number;
  amount: number;
  result: "pending" | "win" | "lose" | "push";
}

export interface CreateBetData {
  match_id: number;
  type_id: number;
  name: string;
  line: number;
  odds: number;
  amount: number;
}

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export type BetsQueryParams = {
  matchId?: number | null;
  after?: number | null;
};

export const betsQueryOptions = (params: BetsQueryParams) => ({
  queryKey: ["bets", { matchId: params.matchId, after: params.after }] as const,
  queryFn: async (): Promise<{
    bets: Bet[];
    cursor?: number | null;
    has_next?: boolean | null;
  }> => {
    const searchParams = new URLSearchParams();
    if (typeof params.matchId === "number") {
      searchParams.append("match_id", params.matchId.toString());
    }
    if (typeof params.after === "number") {
      searchParams.append("after", params.after.toString());
    }
    const queryString = searchParams.size > 0 ? searchParams.toString() : "";
    const response = await fetch(`${baseUrl}/bets?${queryString}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.json();
  },
});

export const matchBetsQueryOptions = (matchId: number) => ({
  queryKey: ["bets", { matchId }] as const,
  queryFn: async (): Promise<Bet[]> => {
    const response = await fetch(`${baseUrl}/bets?match_id=${matchId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch match bets: ${response.status}`);
    }

    return response.json();
  },
});

export type BetOverview = {
  bets: Bet[];
  num_pending: number;
  total_wagered: number;
  win_rate: number;
  gross_payout: number;
  net_profit: number;
  gross_loss: number;
  roi: number;
};

export const betOverviewQueryOptions = () => ({
  queryKey: ["bets", "overview"] as const,
  queryFn: async (): Promise<BetOverview> => {
    const response = await fetch(`${baseUrl}/bets/overview`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },
});

export function useCreateBet() {
  const queryClient = useQueryClient();
  const auth = useAuth();
  return useMutation<Bet, unknown, CreateBetData>(() => ({
    mutationFn: async (betData: CreateBetData) => {
      if (auth.isReadOnly()) {
        return null;
      }

      const response = await fetch(`${baseUrl}/bets`, {
        method: "POST",
        headers: auth.headers(),
        body: JSON.stringify(betData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create bet: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ["bets", { matchId: data.match_id }],
      });
      queryClient.invalidateQueries({ queryKey: ["bets", "overview"] });
    },
  }));
}

export function useUpdateBet() {
  const queryClient = useQueryClient();
  const { headers, isReadOnly } = useAuth();
  return useMutation(() => ({
    mutationFn: async (input: { id: number; result: Bet["result"] }) => {
      if (isReadOnly()) return;

      const { id, ...body } = input;
      const response = await fetch(`${baseUrl}/bets/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(body),
      });

      return response.json();
    },
    onSettled: (_data, error) => {
      if (error == null)
        queryClient.invalidateQueries({
          queryKey: ["bets"],
        });
    },
  }));
}

export function useDeleteBet() {
  const queryClient = useQueryClient();
  const { headers, isReadOnly } = useAuth();
  return useMutation(() => ({
    mutationFn: async (id: number) => {
      if (isReadOnly()) return;

      const response = await fetch(`${baseUrl}/bets/${id}`, {
        method: "DELETE",
        headers: headers(),
      });

      if (!response.ok) {
        throw new Error(`Failed to delete bet: ${response.status}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bets"] });
    },
  }));
}
