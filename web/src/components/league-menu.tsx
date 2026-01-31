import { ContextMenu } from "@kobalte/core/context-menu";
import { DropdownMenu } from "@kobalte/core/dropdown-menu";
import { useQuery } from "@tanstack/solid-query";
import type { JSX, ValidComponent } from "solid-js";
import { Show } from "solid-js";
import {
  leaguesQueryOptions,
  useToggleLeague,
  useTrackLeague,
} from "~/api/leagues";
import { useAuth } from "~/contexts/auth";

type LeagueState = "followed" | "hidden" | "none";

interface LeagueMenuProps<T extends ValidComponent = "div"> {
  league: { id: number; name: string };
  children?: JSX.Element;
  trigger: "context" | "dropdown";
  as?: T;
  class?: string;
}

export function LeagueMenu<T extends ValidComponent = "div">(
  props: LeagueMenuProps<T>,
) {
  const auth = useAuth();
  const toggleLeague = useToggleLeague();
  const trackLeague = useTrackLeague();
  const leaguesQuery = useQuery(() => leaguesQueryOptions(auth.headers));

  const leagueState = (): LeagueState => {
    const leagues = leaguesQuery.data ?? [];
    const league = leagues.find(l => l.id === props.league.id);
    if (!league) return "none";
    return league.hidden ? "hidden" : "followed";
  };

  const handleFollow = () => {
    const state = leagueState();
    if (state === "none") {
      trackLeague.mutate({
        id: props.league.id,
        name: props.league.name,
        hidden: false,
      });
    } else {
      toggleLeague.mutate({
        id: props.league.id,
        hidden: false,
      });
    }
  };

  const handleHide = () => {
    const state = leagueState();
    if (state === "none") {
      trackLeague.mutate({
        id: props.league.id,
        name: props.league.name,
        hidden: true,
      });
    } else {
      toggleLeague.mutate({
        id: props.league.id,
        hidden: true,
      });
    }
  };

  return (
    <Show
      when={props.trigger === "context"}
      fallback={
        <DropdownMenu>
          <DropdownMenu.Trigger
            class="btn btn-ghost btn-sm btn-square"
            aria-label="League settings"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <Show when={!auth.isReadOnly()}>
              <DropdownMenu.Content class="dropdown-content menu shadow bg-base-100 rounded-box w-48 z-50">
                <Show when={leagueState() !== "followed"}>
                  <DropdownMenu.Item
                    as="li"
                    class="hover:cursor-default"
                    onSelect={handleFollow}
                  >
                    <DropdownMenu.ItemLabel>
                      Follow League
                    </DropdownMenu.ItemLabel>
                  </DropdownMenu.Item>
                </Show>
                <Show when={leagueState() !== "hidden"}>
                  <DropdownMenu.Item
                    as="li"
                    class="hover:cursor-default"
                    onSelect={handleHide}
                  >
                    <DropdownMenu.ItemLabel>Hide League</DropdownMenu.ItemLabel>
                  </DropdownMenu.Item>
                </Show>
              </DropdownMenu.Content>
            </Show>
          </DropdownMenu.Portal>
        </DropdownMenu>
      }
    >
      <ContextMenu>
        <ContextMenu.Trigger as={props.as ?? "div"} class={props.class}>
          {props.children ?? null}
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <Show when={!auth.isReadOnly()}>
            <ContextMenu.Content class="dropdown-content menu shadow bg-base-100 rounded-box w-48 z-50">
              <Show when={leagueState() !== "followed"}>
                <ContextMenu.Item
                  as="li"
                  class="hover:cursor-default"
                  onSelect={handleFollow}
                >
                  <ContextMenu.ItemLabel>Follow League</ContextMenu.ItemLabel>
                </ContextMenu.Item>
              </Show>
              <Show when={leagueState() !== "hidden"}>
                <ContextMenu.Item
                  as="li"
                  class="hover:cursor-default"
                  onSelect={handleHide}
                >
                  <ContextMenu.ItemLabel>Hide League</ContextMenu.ItemLabel>
                </ContextMenu.Item>
              </Show>
            </ContextMenu.Content>
          </Show>
        </ContextMenu.Portal>
      </ContextMenu>
    </Show>
  );
}
