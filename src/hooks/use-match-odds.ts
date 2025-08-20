import { useQuery } from "@tanstack/react-query";

export interface OddsValue {
	name: string;
	odd: number;
}

export interface OddsMarket {
	name: string;
	values: OddsValue[];
}

export function useMatchOdds(matchId: number) {
	return useQuery({
		queryKey: ["odds", { matchId }],
		queryFn: async function (): Promise<OddsMarket[]> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/odds/${matchId}`,
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch odds: ${response.status}`);
			}

			return response.json();
		},
	});
}
