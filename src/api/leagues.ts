import { useMutation, useQuery } from "@tanstack/solid-query";
import { useAuth } from "~/contexts/auth";

export interface League {
	id: number;
	name: string;
}

export function useLeagues() {
	const auth = useAuth();
	return useQuery(() => ({
		queryKey: ["leagues"],
		queryFn: async function (): Promise<League[]> {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/leagues`,
				{
					method: "GET",
					headers: auth.headers(),
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch leagues: ${response.status}`);
			}

			const body = await response.json();
			return body.leagues;
		},
	}));
}

export function useHideLeague() {
	const auth = useAuth();
	return useMutation(() => ({
		mutationFn: async function (id: number) {
			if (auth.isReadOnly()) {
				return null;
			}

			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/leagues/${id}/hide`,
				{
					method: "POST",
					headers: auth.headers(),
				},
			);

			if (!response.ok) {
				throw new Error("Failed to hide league");
			}

			return response.json();
		},
	}));
}

export function useFollowLeague() {
	const auth = useAuth();
	return useMutation(() => ({
		mutationFn: async function (league: { id: number; name: string }) {
			if (auth.isReadOnly()) {
				return null;
			}

			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/leagues`,
				{
					method: "POST",
					headers: {
						...auth.headers(),
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ id: league.id, name: league.name }),
				},
			);

			if (!response.ok) {
				throw new Error("Failed to follow league");
			}

			return response.json();
		},
	}));
}
