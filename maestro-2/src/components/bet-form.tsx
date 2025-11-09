import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { CreateBetData, useCreateBet } from "~/api/bets";
import { useAuth } from "~/contexts/auth";

export interface BetFormProps {
  matchId: number;
  onBetCreated: () => void;
  onCancel: () => void;
  initialData?: {
    type_id: number;
    description: string;
    odds: number;
    line?: number;
  };
}

export default function BetForm({
  matchId,
  onBetCreated,
  onCancel,
  initialData,
}: BetFormProps) {
  const [errors, setErrors] = createSignal<string[]>([]);
  const [isSubmitting] = createSignal(false);
  const [formData, setFormData] = createStore({ ...initialData });

  const auth = useAuth();
  const createBet = useCreateBet();

  const validateBet = (betData: CreateBetData): string[] => {
    const errors: string[] = [];

    if (!betData.match_id) errors.push("Match is required");
    if (!betData.name.trim()) errors.push("Description is required");
    if (betData.odds === 0) errors.push("Odds cannot be zero");
    if (betData.odds > -100 && betData.odds < 100 && betData.odds !== 0) {
      errors.push("Odds must be +100 or greater, or -100 or less");
    }
    if (betData.amount <= 0) errors.push("Amount must be positive");

    return errors;
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();

    const formData = new FormData(e.target as HTMLFormElement);
    const betData: CreateBetData = {
      match_id: matchId,
      type_id: initialData?.type_id ?? -1,
      name: formData.get("description")!.toString(),
      line: new Number(formData.get("line")!.toString()) as number,
      odds: new Number(formData.get("odds")!.toString()) as number,
      amount: new Number(formData.get("amount")!.toString()) as number,
    };

    const validationErrors = validateBet(betData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    createBet.mutate(betData, { onSuccess: onBetCreated });
  };

  if (auth.isReadOnly()) {
    return (
      <div class="modal modal-open" onClick={onCancel}>
        <div class="modal-box" onClick={(e) => e.stopPropagation()}>
          <div class="flex justify-between items-center mb-4">
            <h3 class="font-bold text-lg">API Token Required</h3>
            <button class="btn btn-sm btn-circle btn-ghost" onClick={onCancel}>
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
              <button class="btn btn-ghost" onClick={onCancel}>
                Cancel
              </button>
              <a href="/maestro/settings" class="btn btn-primary">
                Go to Settings
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="modal modal-open" onClick={onCancel}>
      <div
        class="modal-box w-11/12 max-w-5xl max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg">Record New Bet</h3>
          <button class="btn btn-sm btn-circle btn-ghost" onClick={onCancel}>
            ✕
          </button>
        </div>

        <Show when={errors.length > 0}>
          <div class="alert alert-error mb-4">
            <ul>
              <For each={errors()}>{(item) => <li>{item}</li>}</For>
            </ul>
          </div>
        </Show>

        <Show when={initialData}>
          <div class="mb-4">
            <h4 class="font-semibold text-md">Place Your Bet</h4>
            <p class="text-sm text-base-content/60">
              {initialData?.description} at {initialData?.odds! > 0 ? "+" : ""}
              {initialData?.odds}
            </p>
          </div>
        </Show>

        <form onSubmit={handleSubmit}>
          <div class="form-control w-full mb-4">
            <label class="label">
              <span class="label-text">Description</span>
            </label>
            <input
              type="text"
              name="description"
              placeholder="e.g., Chelsea to win, Over 2.5 goals"
              class="input input-bordered w-full"
              value={formData.description}
              required
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Line</span>
              </label>
              <input
                name="line"
                type="number"
                step="0.5"
                placeholder="-1.5, 2.5, 0"
                class="input input-bordered"
                value={formData.line}
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Odds</span>
              </label>
              <input
                name="odds"
                type="number"
                step="1"
                placeholder="-150, +200"
                class="input input-bordered"
                value={formData.odds}
                required
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text">Amount ($)</span>
              </label>
              <input
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="100.00"
                class="input input-bordered"
                required
              />
            </div>
          </div>

          <div class="modal-action">
            <button
              class="btn btn-ghost"
              onClick={onCancel}
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
    </div>
  );
}
