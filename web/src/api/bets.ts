import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { Accessor } from "solid-js";
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

export interface BettingStats {
	totalBets: number;
	totalWagered: number;
	totalWinnings: number;
	totalLosses: number;
	netProfit: number;
	roi: number;
	winRate: number;
	pendingBets: number;
}

export interface CreateBetData {
	match_id: number;
	type_id: number;
	name: string;
	line: number;
	odds: number;
	amount: number;
}

export interface UpdateBetData {
	description?: string;
	line?: number;
	odds?: number;
	amount?: number;
	result?: Bet["result"];
}

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export function useBets(
	matchId: Accessor<number | null>,
	after: Accessor<number | null>,
) {
	return useQuery<{
		bets: Bet[];
		cursor?: number | null;
		has_next?: boolean | null;
	}>(() => ({
		queryKey: ["bets", { matchId: matchId(), after: after() }],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (typeof matchId() === "number") {
				params.append("match_id", matchId()!.toString());
			}
			if (typeof after() === "number") {
				params.append("after", after()!.toString());
			}
			const queryString = params.size > 0 ? params.toString() : "";
			const response = await fetch(`${baseUrl}/bets?${queryString}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});
			return response.json();
		},
	}));
}

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
		onSuccess: (data) => {
			// invalidate because if there were no bets in the cache, normalization won't kick in
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
		onSettled: (data, error, input) => {
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
			// todo: auto-normaliztion won't happen because server returns empty body
			queryClient.invalidateQueries({ queryKey: ["bets"] });
		},
	}));
}

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

export function useBetOverview() {
	return useQuery(() => ({
		queryKey: ["bets", "overview"],
		queryFn: async function (): Promise<BetOverview> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/bets/overview`,
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return response.json();
		},
	}));
}
