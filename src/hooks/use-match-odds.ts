import { useState, useEffect } from "preact/hooks";

export interface OddsValue {
	name: string;
	odd: number;
}

export interface OddsMarket {
	name: string;
	values: OddsValue[];
}

export interface UseMatchOddsResult {
	odds: OddsMarket[];
	loading: boolean;
	error: string | null;
}

export function useMatchOdds(matchId: number): UseMatchOddsResult {
	const [odds, setOdds] = useState<OddsMarket[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchOdds = async () => {
			if (!matchId) {
				setOdds([]);
				setLoading(false);
				return;
			}

			setLoading(true);
			setError(null);

			try {
				const response = await fetch(
					`${import.meta.env.VITE_API_BASE_URL}/odds/${matchId}`,
				);

				if (!response.ok) {
					throw new Error(`Failed to fetch odds: ${response.status}`);
				}

				const data = await response.json();
				setOdds(data);
			} catch (err) {
				console.error("Error fetching match odds:", err);
				setError(err instanceof Error ? err.message : "Failed to fetch odds");
				setOdds([]);
			} finally {
				setLoading(false);
			}
		};

		fetchOdds();
	}, [matchId]);

	return { odds, loading, error };
}
