import { useQuery } from "@tanstack/react-query";

export interface Bet {
	id: number;
	match_id: number;
	name: string;
	amount: number;
	line: number;
	odds: number;
	result: "win" | "lose" | "pending";
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

export function useBetOverview() {
	return useQuery({
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
	});
}
