import { useQuery } from "@tanstack/solid-query";
import { createMemo, Match, Show, Switch, useContext } from "solid-js";
import type { TeamMetrics } from "~/api/analysis";
import type { Fixture, OddsStat } from "~/api/fixtures";
import { cornerPickQueryOptions } from "~/api/llm";
import { BetFormContext } from "~/components/bet-form.context";
import { useAuth } from "~/contexts/auth";
import { formatOdds } from "~/lib/formatters";

interface CornerPickCardProps {
  fixture: Fixture;
  odds: OddsStat[] | undefined;
  form: {
    home: TeamMetrics | undefined;
    away: TeamMetrics | undefined;
  };
  season: {
    home: TeamMetrics | undefined;
    away: TeamMetrics | undefined;
  };
  venue: {
    home: TeamMetrics | undefined;
    away: TeamMetrics | undefined;
  };
  isPending: boolean;
  hasError: boolean;
}

export function CornerPickCard(props: CornerPickCardProps) {
  const auth = useAuth();
  const [_, { show }] = useContext(BetFormContext);

  const pickQuery = useQuery(() =>
    cornerPickQueryOptions({
      fixture: props.fixture,
      odds: props.odds,
      metrics: {
        form: props.form,
        season: props.season,
        venue: props.venue,
      },
      openAiKey: auth.openAiKey(),
    }),
  );

  const pick = () => pickQuery.data?.pick ?? null;

  const confidenceLabel = createMemo(() => {
    const value = pick()?.confidence;
    if (value == null) return "";
    return `${Math.round(value * 100)}% confidence`;
  });

  const rationale = createMemo(() => pick()?.rationale ?? "");

  return (
    <div class="card bg-base-100 border border-base-300">
      <div class="card-body">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">Corner Pick</h3>
          <div class="flex items-center gap-2">
            <Show when={pick()}>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                onClick={() => {
                  const currentPick = pick();
                  if (!currentPick) return;
                  const lineValue = currentPick.line.value;

                  show(props.fixture.id, {
                    type_id: currentPick.market_id,
                    description: `${currentPick.market_name} ${currentPick.line.name}`,
                    odds: currentPick.line.odd,
                    line: lineValue != null ? Math.abs(lineValue) : undefined,
                  });
                }}
              >
                Save Bet
              </button>
            </Show>
            <button
              type="button"
              class="btn btn-ghost btn-xs"
              onClick={() => pickQuery.refetch()}
              disabled={!auth.openAiKey() || pickQuery.isFetching}
            >
              Refresh
            </button>
            <Switch>
              <Match when={props.isPending || pickQuery.isFetching}>
                <span class="loading loading-spinner loading-xs" />
              </Match>
              <Match when={props.hasError || pickQuery.isError}>
                <span class="text-error text-sm">Failed to load</span>
              </Match>
              <Match when={pick()}>
                <span class="badge badge-ghost badge-sm">AI</span>
              </Match>
            </Switch>
          </div>
        </div>

        <Switch>
          <Match when={!auth.openAiKey()}>
            <div class="text-sm text-base-content/60">
              Add your OpenAI API key in Settings to enable corner picks.
            </div>
          </Match>

          <Match when={props.hasError || pickQuery.isError}>
            <div class="alert alert-error">
              <span>Failed to load corner pick</span>
            </div>
          </Match>

          <Match when={props.isPending || pickQuery.isFetching}>
            <div class="text-sm text-base-content/60">Loading corner pick…</div>
          </Match>

          <Match when={(props.odds ?? []).length === 0}>
            <div class="text-sm text-base-content/60">
              No corner markets available
            </div>
          </Match>

          <Match when={!pick()}>
            <div class="text-sm text-base-content/60">No recommended bet</div>
          </Match>

          <Match when={pick()}>
            <div class="space-y-3">
              <div class="space-y-1">
                <div class="text-sm font-medium">{pick()!.market_name}</div>
                <div class="flex flex-wrap items-center gap-2 text-sm">
                  <span class="font-medium">{pick()!.line.name}</span>
                  <span class="font-mono text-base-content/70">
                    {formatOdds(pick()!.line.odd)}
                  </span>
                </div>
              </div>

              <Show when={confidenceLabel()}>
                <span class="badge badge-success badge-sm">
                  {confidenceLabel()}
                </span>
              </Show>

              <Show when={rationale()}>
                <p class="text-xs text-base-content/70">{rationale()}</p>
              </Show>
            </div>
          </Match>
        </Switch>
      </div>
    </div>
  );
}
