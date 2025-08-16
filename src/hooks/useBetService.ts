import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";

export interface Bet {
	id: number;
	match_id: number;
	name: string;
	line: number;
	odds: number;
	amount: number;
	result: "pending" | "win" | "loss" | "push";
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
	matchId: string;
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
	result?: "win" | "loss" | "push";
}

const baseUrl = import.meta.env.VITE_API_BASE_URL;

export function useBetService() {
	const { headers, isReadOnly } = useAuth();
	const baseUrl = import.meta.env.VITE_API_BASE_URL;

	const createBet = async (betData: CreateBetData): Promise<Bet> => {
		if (isReadOnly) {
			throw new Error("API token required for creating bets");
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
	};

	const getBetsByMatch = async (matchId: string): Promise<Bet[]> => {
		const response = await fetch(`${baseUrl}/bets`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
			body: new URLSearchParams({ matchId }),
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch bets: ${response.status}`);
		}

		return response.json();
	};

	const getAllBets = async (): Promise<Bet[]> => {
		const response = await fetch(`${baseUrl}/bets`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch bets: ${response.status}`);
		}

		return response.json();
	};

	const updateBet = async (
		id: string,
		updates: UpdateBetData,
	): Promise<Bet> => {
		if (isReadOnly) {
			throw new Error("API token required for updating bets");
		}

		const response = await fetch(`${baseUrl}/bets/${id}`, {
			method: "PATCH",
			headers,
			body: JSON.stringify(updates),
		});

		if (!response.ok) {
			throw new Error(`Failed to update bet: ${response.status}`);
		}

		return response.json();
	};

	const deleteBet = async (id: string): Promise<void> => {
		if (isReadOnly) {
			throw new Error("API token required for deleting bets");
		}

		const response = await fetch(`${baseUrl}/bets/${id}`, {
			method: "DELETE",
			headers,
		});

		if (!response.ok) {
			throw new Error(`Failed to delete bet: ${response.status}`);
		}
	};

	const getBettingStats = async (): Promise<BettingStats> => {
		const response = await fetch(`${baseUrl}/bets/stats`, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch betting stats: ${response.status}`);
		}

		return response.json();
	};

	return {
		createBet,
		getBetsByMatch,
		getAllBets,
		updateBet,
		deleteBet,
		getBettingStats,
		isReadOnly,
	};
}

export function useBets(matchId?: number) {
	return useQuery<{ bets: Bet[] }>({
		queryKey: ["bets", matchId],
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
