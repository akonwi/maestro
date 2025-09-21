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

export const useJuice = (date: string) => {
	return useQuery({
		queryKey: ["juice", date],
		queryFn: async (): Promise<JuiceFixture[]> => {
			const url = date 
				? `${import.meta.env.VITE_API_BASE_URL}/juice?date=${date}`
				: `${import.meta.env.VITE_API_BASE_URL}/juice`;
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error("Failed to fetch value bets");
			}
			return response.json();
		},
	});
};
