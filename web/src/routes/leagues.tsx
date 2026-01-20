import { useQueryClient } from "@tanstack/solid-query";
import { For, Suspense } from "solid-js";
import { useLeagues, useToggleLeague } from "~/api/leagues";

export default function LeaguesPage() {
  const leaguesQuery = useLeagues();
  const toggleLeague = useToggleLeague();
  const queryClient = useQueryClient();

  const handleToggleLeague = (league: {
    id: number;
    name: string;
    hidden: boolean;
  }) => {
    const newHiddenState = !league.hidden;
    toggleLeague.mutate(
      { id: league.id, hidden: newHiddenState },
      {
        onSuccess: () => {
          // Update the local cache to reflect the change immediately
          queryClient.setQueryData(["leagues"], (oldData: any) => {
            if (!oldData) return oldData;
            return oldData.map((l: any) =>
              l.id === league.id ? { ...l, hidden: newHiddenState } : l,
            );
          });
        },
      },
    );
  };

  return (
    <Suspense
      fallback={
        <div class="flex items-center justify-center">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
        </div>
      }
    >
      <div class="card bg-base-100 border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Leagues</h2>

          <div class="space-y-2">
            <For each={leaguesQuery.data}>
              {league => (
                <div class="py-2">
                  <div class="flex items-center justify-between">
                    <div
                      class="font-medium tooltip tooltip-right cursor-pointer"
                      data-tip={`ID: ${league.id}`}
                      onClick={() =>
                        navigator.clipboard.writeText(league.id.toString())
                      }
                    >
                      {league.name}
                    </div>
                    <input
                      type="checkbox"
                      class="toggle toggle-primary toggle-sm"
                      checked={!league.hidden}
                      onChange={() => handleToggleLeague(league)}
                    />
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Suspense>
  );
}
