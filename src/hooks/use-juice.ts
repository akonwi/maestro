import { useQuery } from "@tanstack/react-query";

export interface JuiceFixture {
	fixture: {
		id: number;
		date: string;
		timestamp: number;
		league_id: number;
		league_name: string;
		season: number;
		home: {
			id: number;
			name: string;
			logo: string;
		};
		away: {
			id: number;
			name: string;
			logo: string;
		};
	};
	stats: Array<{
		id: number;
		name: string;
		values: Array<{
			name: string;
			odd: number;
		}>;
	}>;
}

export const useJuice = () => {
	return useQuery({
		queryKey: ["juice"],
		queryFn: async (): Promise<JuiceFixture[]> => {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/juice`,
			);
			if (!response.ok) {
				throw new Error("Failed to fetch value bets");
			}
			return response.json();
		},
	});
};
