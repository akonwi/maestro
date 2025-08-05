import { useState, useEffect } from "preact/hooks";

export interface ApiBet {
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
	bets: ApiBet[];
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
}

export function useBetOverview() {
	const [data, setData] = useState<BetOverviewResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchBetOverview = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch(
				"https://maestro-api.zeabur.app/bets/overview",
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const result = await response.json();
			setData(result);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to fetch betting overview",
			);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchBetOverview();
	}, []);

	return { data, loading, error, refetch: fetchBetOverview };
}
