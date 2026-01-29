import { Toast, toaster } from "@kobalte/core/toast";
import { A } from "@solidjs/router";
import { useQuery } from "@tanstack/solid-query";
import { createMemo, createSignal, For, Show, useContext } from "solid-js";
import { createStore } from "solid-js/store";
import {
  betOverviewQueryOptions,
  CreateBetData,
  useCreateBet,
} from "~/api/bets";
import { useAuth } from "~/contexts/auth";
import {
  calculatePayout,
  formatOdds,
  formatPercentage,
} from "~/lib/formatters";
import { BetFormContext } from "./bet-form.context";

export interface BetFormProps {
  matchId: number;
  onBetCreated?: () => void;
  onCancel?: () => void;
  initialData?: {
    type_id: number;
    description: string;
    odds: number;
    line?: number;
    confidence?: {
      tier: number;
      score: number;
      edge: number;
      formDelta: number;
      projection: number;
      basis: "home" | "away" | "total";
    };
  };
}

export function BetForm({ matchId, initialData, ...callbacks }: BetFormProps) {
  const [_, context] = useContext(BetFormContext);
  const close = callbacks.onCancel ?? context.close;
  const onFinish = callbacks?.onBetCreated ?? close;
  const [errors, setErrors] = createSignal<string[]>([]);
  const [isSubmitting] = createSignal(false);
  const [formData, setFormData] = createStore({ ...initialData, amount: 5 });

  const auth = useAuth();
  const createBet = useCreateBet();
  const overviewQuery = useQuery(() => betOverviewQueryOptions());

  const payout = createMemo(() => {
    const amt = formData.amount || 0;
    const oddsVal = formData.odds || 0;
    if (oddsVal === 0 || amt === 0) return 0;
    return calculatePayout(amt, oddsVal);
  });

  const initialOdds = createMemo(() => initialData?.odds ?? 0);

  const confidenceLabel = createMemo(() => {
    const confidence = formData.confidence;
    if (!confidence) return undefined;
    if (confidence.tier >= 5) return "Elite";
    if (confidence.tier === 4) return "Strong";
    if (confidence.tier === 3) return "Moderate";
    if (confidence.tier === 2) return "Cautious";
    return "Thin";
  });

  const roiPreview = createMemo(() => {
    const overview = overviewQuery.data;
    const amount = formData.amount || 0;
    if (!overview || amount <= 0) return undefined;
    const totalWagered = overview.total_wagered ?? 0;
    const netProfit = overview.net_profit ?? 0;
    const nextTotal = totalWagered + amount;
    if (nextTotal <= 0) return undefined;
    const nextProfit = netProfit - amount;
    const nextRoi = (nextProfit / nextTotal) * 100;
    return {
      current: overview.roi ?? 0,
      next: nextRoi,
    };
  });

  const validateBet = (betData: CreateBetData): string[] => {
    const errors: string[] = [];

    if (!betData.name.trim()) errors.push("Description is required");
    if (betData.odds === 0) errors.push("Odds cannot be zero");
    if (betData.amount <= 0) errors.push("Amount must be positive");

    return errors;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const betData: CreateBetData = {
      match_id: matchId,
      type_id: formData.type_id ?? -1,
      name: formData.description!.toString(),
      line: formData.line ?? 0,
      odds: formData.odds!,
      amount: formData.amount!,
    };

    const validationErrors = validateBet(betData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    createBet.mutate(betData, {
      onSuccess: () => {
        const id = toaster.show(props => (
          <Toast
            toastId={props.toastId}
            class="alert bordered border-base-300 w-full flex justify-between"
          >
            <Toast.Title>
              Saved {formData.description} - {formatOdds(formData.odds ?? 0)}{" "}
              for {formData.amount}
            </Toast.Title>
            <Toast.CloseButton
              class="btn btn-sm"
              onClick={() => toaster.dismiss(id)}
            >
              ×
            </Toast.CloseButton>
          </Toast>
        ));
        onFinish();
      },
    });
  };

  if (auth.isReadOnly()) {
    return (
      <div class="modal modal-open">
        <div
          class="modal-box"
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
          role="dialog"
          tabIndex={-1}
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">API Token Required</h3>
            <button
              type="button"
              class="btn btn-sm btn-circle btn-ghost"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <div class="text-center py-8">
            <div class="text-6xl mb-4">🔒</div>
            <h4 class="text-lg font-medium mb-2">Betting Features Locked</h4>
            <p class="text-base-content/60 mb-6">
              Please configure your API token in Settings to record and manage
              bets.
            </p>
            <div class="space-x-2">
              <button type="button" class="btn btn-ghost" onClick={close}>
                Cancel
              </button>
              <A href="/settings" class="btn btn-primary">
                Go to Settings
              </A>
            </div>
          </div>
        </div>
        <button
          type="button"
          class="modal-backdrop"
          onClick={close}
          aria-label="Close"
        />
      </div>
    );
  }

  return (
    <div class="modal modal-open">
      <div
        class="modal-box w-11/12 max-w-5xl max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg">Record New Bet</h3>
          <button
            type="button"
            class="btn btn-sm btn-circle btn-ghost"
            onClick={close}
          >
            ✕
          </button>
        </div>

        <Show when={errors.length > 0}>
          <div class="alert alert-error mb-4">
            <ul>
              <For each={errors()}>{item => <li>{item}</li>}</For>
            </ul>
          </div>
        </Show>

        <Show when={initialData}>
          <div class="mb-4">
            <h4 class="font-semibold text-md">Place Your Bet</h4>
            <p class="text-sm text-base-content/60">
              {initialData?.description} at {initialOdds() > 0 ? "+" : ""}
              {initialOdds()}
            </p>
          </div>
        </Show>

        <Show when={formData.confidence}>
          <div class="mb-4">
            <div class="flex items-center gap-2">
              <span
                class={`badge ${
                  formData.confidence!.tier >= 4
                    ? "badge-success"
                    : formData.confidence!.tier >= 3
                      ? "badge-warning"
                      : "badge-ghost"
                }`}
              >
                Confidence {formData.confidence!.tier}
              </span>
              <span class="text-sm text-base-content/70">
                {confidenceLabel()}
              </span>
            </div>
            <div class="text-xs text-base-content/60 mt-1">
              Edge {formData.confidence!.edge > 0 ? "+" : ""}
              {formData.confidence!.edge.toFixed(1)} | Form vs season{" "}
              {formData.confidence!.formDelta > 0 ? "+" : ""}
              {formData.confidence!.formDelta.toFixed(1)} | Projection{" "}
              {formData.confidence!.projection.toFixed(1)}
            </div>
          </div>
        </Show>

        <form onSubmit={handleSubmit}>
          <div class="form-control w-full mb-4">
            <label class="label" for="bet-description">
              <span class="label-text">Description</span>
            </label>
            <input
              id="bet-description"
              type="text"
              name="description"
              placeholder="e.g., Chelsea to win, Over 2.5 goals"
              class="input input-bordered w-full"
              value={formData.description}
              onChange={e => setFormData({ description: e.target.value })}
              required
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="form-control">
              <label class="label" for="bet-line">
                <span class="label-text">Line</span>
              </label>
              <input
                id="bet-line"
                name="line"
                type="number"
                step="0.5"
                placeholder="-1.5, 2.5, 0"
                class="input input-bordered"
                value={formData.line}
                onChange={e =>
                  setFormData({ line: new Number(e.target.value).valueOf() })
                }
              />
            </div>

            <div class="form-control">
              <label class="label" for="bet-odds">
                <span class="label-text">Odds</span>
              </label>
              <input
                id="bet-odds"
                name="odds"
                type="number"
                step="1"
                placeholder="-150, +200"
                class="input input-bordered"
                value={formData.odds}
                onChange={e =>
                  setFormData({ odds: new Number(e.target.value).valueOf() })
                }
                required
              />
            </div>

            <div class="form-control">
              <label class="label" for="bet-amount">
                <span class="label-text">Amount ($)</span>
                <Show
                  when={
                    (formData.odds || 0) !== 0 && (formData.amount || 0) > 0
                  }
                >
                  <span class="label-text-alt text-sm text-success">
                    Payout: ${payout().toFixed(2)}
                  </span>
                </Show>
              </label>

              <input
                id="bet-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="100.00"
                class="input input-bordered"
                value={formData.amount}
                onChange={e =>
                  setFormData({ amount: new Number(e.target.value).valueOf() })
                }
                required
              />
            </div>
          </div>

          <Show when={roiPreview()}>
            <div class="alert mb-4">
              <span class="text-sm">
                If this bet loses, ROI to {formatPercentage(roiPreview()!.next)}
                (current {formatPercentage(roiPreview()!.current)})
              </span>
            </div>
          </Show>

          <div class="modal-action">
            <button
              type="reset"
              class="btn btn-ghost"
              onClick={close}
              disabled={isSubmitting()}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              disabled={isSubmitting()}
            >
              {isSubmitting() ? "Creating..." : "Create Bet"}
            </button>
          </div>
        </form>
      </div>
      <button
        type="button"
        class="modal-backdrop"
        onClick={close}
        aria-label="Close"
      />
    </div>
  );
}
