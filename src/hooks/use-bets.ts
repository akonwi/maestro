import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";

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

export function useBets(matchId?: number) {
	return useQuery<{ bets: Bet[] }>({
		queryKey: ["bets", { matchId }],
		queryFn: async () => {
			const queryParams =
				matchId != null
					? new URLSearchParams({ match_id: matchId.toString() }).toString()
					: undefined;
			const response = await fetch(`${baseUrl}/bets?${queryParams}`, {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});
			return response.json();
		},
	});
}

export function useCreateBet() {
	const queryClient = useQueryClient();
	const { isReadOnly, headers } = useAuth();
	return useMutation<Bet, unknown, CreateBetData>({
		mutationFn: async (betData: CreateBetData) => {
			if (isReadOnly) {
				return null;
			}

			const response = await fetch(`${baseUrl}/bets`, {
				method: "POST",
				headers,
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
	});
}

export function useUpdateBet() {
	const queryClient = useQueryClient();
	const { headers, isReadOnly } = useAuth();
	return useMutation({
		mutationFn: async (input: { id: number; result: Bet["result"] }) => {
			if (isReadOnly) return;

			const { id, ...body } = input;
			const response = await fetch(`${baseUrl}/bets/${id}`, {
				method: "PATCH",
				headers,
				body: JSON.stringify(body),
			});

			return response.json();
		},
		onSuccess: () => {
			// todo: auto-normaliztion won't happen because server returns empty body
			queryClient.invalidateQueries({
				queryKey: ["bets", "overview"],
				predicate: (query) => query.queryKey[0] == "bets",
			});
		},
	});
}

export function useDeleteBet() {
	const queryClient = useQueryClient();
	const { headers, isReadOnly } = useAuth();
	return useMutation({
		mutationFn: async (id: number) => {
			if (isReadOnly) return;

			const response = await fetch(`${baseUrl}/bets/${id}`, {
				method: "DELETE",
				headers,
			});

			if (!response.ok) {
				throw new Error(`Failed to delete bet: ${response.status}`);
			}
		},
		onSuccess: () => {
			// todo: auto-normaliztion won't happen because server returns empty body
			queryClient.invalidateQueries({ queryKey: ["bets"] });
		},
	});
}
