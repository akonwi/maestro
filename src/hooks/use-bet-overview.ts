import { useQuery } from "@tanstack/react-query";
import { Match } from "../types";

export interface Bet {
	id: number;
	match_id: number;
	name: string;
	amount: number;
	line: number;
	odds: number;
	result: string; // "win" | "lose" | "pending"
}

export interface Team {
	id: number;
	name: string;
	code: string | null;
	league_id: number;
}

export interface BetOverview {
	bets: Bet[];
	num_pending: number;
	total_wagered: number;
	win_rate: number;
	gross_payout: number;
	net_profit: number;
	gross_loss: number;
	roi: number;
}

export interface BetOverviewResponse {
	overview: BetOverview;
	teams: Record<string, Team>;
	matches: Match[];
}

export function useBetOverview() {
	return useQuery({
		queryKey: ["bets"],
		queryFn: async function (): Promise<BetOverviewResponse> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/bets/overview`,
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return response.json();
		},
	});
}
