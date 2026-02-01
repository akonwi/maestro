import { useMutation } from "@tanstack/solid-query";
import { useAuth } from "~/contexts/auth";

export interface League {
  id: number;
  name: string;
  hidden: boolean;
}

export const leaguesQueryOptions = (headers: () => Record<string, string>) => ({
  queryKey: ["leagues"] as const,
  queryFn: async (): Promise<League[]> => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/leagues`,
      {
        method: "GET",
        headers: headers(),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch leagues: ${response.status}`);
    }

    const body = await response.json();
    return body;
  },
});

export function useTrackLeague() {
  const auth = useAuth();
  return useMutation(() => ({
    mutationFn: async (input: {
      id: number;
      name: string;
      hidden?: boolean;
    }) => {
      if (auth.isReadOnly()) {
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/leagues`,
        {
          method: "POST",
          headers: auth.headers(),
          body: JSON.stringify({ ...input, hidden: input.hidden ?? false }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to track league");
      }

      return response.json();
    },
    onSettled: (_data, _errors, _variables, _result, context) => {
      context.client.invalidateQueries({ queryKey: ["leagues"] });
    },
  }));
}

export function useToggleLeague() {
  const auth = useAuth();
  return useMutation(() => ({
    mutationFn: async (input: { id: number; hidden: boolean }) => {
      if (auth.isReadOnly()) {
        return null;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/leagues`,
        {
          method: "PUT",
          headers: auth.headers(),
          body: JSON.stringify(input),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to update league");
      }

      return response.json();
    },
    onSettled: (_data, _errors, _variables, _result, context) => {
      context.client.invalidateQueries({ queryKey: ["leagues"] });
    },
  }));
}
