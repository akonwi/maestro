import { useMutation } from "@tanstack/solid-query";
import { useAuth } from "~/contexts/auth";

export function useHideLeague() {
	const auth = useAuth();
	return useMutation(() => ({
		mutationFn: async function (id: number) {
			if (auth.isReadOnly()) {
				return null;
			}

			const response = await fetch(
				`${import.meta.baseURL}/leagues/${id}/hide`,
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
