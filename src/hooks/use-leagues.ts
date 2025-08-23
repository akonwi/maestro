import { useQuery } from "@tanstack/react-query";

export interface League {
	id: number;
	name: string;
	code: string;
}

interface LeaguesResponse {
	leagues: League[];
}

export function useLeagues() {
	return useQuery({
		queryKey: ["leagues"],
		queryFn: async function (): Promise<LeaguesResponse> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/leagues`,
			);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			return response.json();
		},
	});
}
