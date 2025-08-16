import { useState } from "preact/hooks";
import { useCreateBet, type CreateBetData } from "../../hooks/useBetService";
import {
  useMatchOdds,
  type OddsMarket,
  type OddsValue,
} from "../../hooks/use-match-odds";
import { populateBetFromOdds } from "../../utils/betting";
import { useAuth } from "../../contexts/AuthContext";

interface BetFormProps {
  matchId: number;
  onBetCreated: () => void;
  onCancel: () => void;
}

export default function BetForm({
  matchId,
  onBetCreated,
  onCancel,
}: BetFormProps) {
  const [formData, setFormData] = useState({
    description: "",
    line: 0,
    odds: 100,
    amount: 0,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);

  const { isReadOnly } = useAuth();
  const createBet = useCreateBet();
  const {
    odds,
    loading: oddsLoading,
    error: oddsError,
  } = useMatchOdds(matchId);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === "description" ? value : Number(value),
    }));
    setErrors([]);
  };

  const handleOddsSelection = (market: OddsMarket, value: OddsValue) => {
    const populatedData = populateBetFromOdds(market, value, formData.amount);
    setFormData(populatedData);
    setShowManualForm(true); // Show the form after selection
    setErrors([]);
  };

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

    const betData: CreateBetData = {
      match_id: matchId,
      name: formData.description,
      line: formData.line,
      odds: formData.odds,
      amount: formData.amount,
    };

    const validationErrors = validateBet(betData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    createBet.mutate(betData, { onSuccess: onBetCreated });
  };

  if (isReadOnly) {
    return (
      <div className="modal modal-open" onClick={onCancel}>
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">API Token Required</h3>
            <button
              className="btn btn-sm btn-circle btn-ghost"
              onClick={onCancel}
            >
              ✕
            </button>
          </div>

          <div className="text-center py-8">
            <div className="text-6xl mb-4">🔒</div>
            <h4 className="text-lg font-medium mb-2">
              Betting Features Locked
            </h4>
            <p className="text-base-content/60 mb-6">
              Please configure your API token in Settings to record and manage
              bets.
            </p>
            <div className="space-x-2">
              <button className="btn btn-ghost" onClick={onCancel}>
                Cancel
              </button>
              <a href="/maestro/settings" className="btn btn-primary">
                Go to Settings
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal modal-open" onClick={onCancel}>
      <div
        className="modal-box w-11/12 max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">Record New Bet</h3>
          <button
            className="btn btn-sm btn-circle btn-ghost"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>

        {errors.length > 0 && (
          <div className="alert alert-error mb-4">
            <ul>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {oddsError && (
          <div className="alert alert-warning mb-4">
            <span>Could not load betting odds: {oddsError}</span>
          </div>
        )}

        {/* Odds Selection Section */}
        {!showManualForm && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold text-md">
                Select from Available Odds
              </h4>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowManualForm(true)}
              >
                Manual Entry
              </button>
            </div>

            {oddsLoading ? (
              <div className="text-center py-8">
                <span className="loading loading-spinner loading-md"></span>
                <p className="text-sm text-base-content/60 mt-2">
                  Loading odds...
                </p>
              </div>
            ) : odds.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-base-content/60">
                  No odds available for this match
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-primary mt-2"
                  onClick={() => setShowManualForm(true)}
                >
                  Enter Manually
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {odds.map((market, marketIndex) => (
                  <div
                    key={marketIndex}
                    className="collapse collapse-arrow bg-base-200"
                  >
                    <input type="checkbox" />
                    <div className="collapse-title text-sm font-medium">
                      {market.name}
                    </div>
                    <div className="collapse-content">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        {market.values.map((value, valueIndex) => (
                          <button
                            key={valueIndex}
                            type="button"
                            className="btn btn-sm btn-outline hover:btn-primary text-left justify-between"
                            onClick={() => handleOddsSelection(market, value)}
                          >
                            <span className="truncate">{value.name}</span>
                            <span className="font-mono text-xs">
                              {value.odd > 0 ? "+" : ""}
                              {value.odd}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Manual Form Section */}
        {!oddsLoading && (showManualForm || odds.length === 0) && (
          <>
            {showManualForm && odds.length > 0 && (
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-md">Bet Details</h4>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => setShowManualForm(false)}
                >
                  Back to Odds
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-control w-full mb-4">
                <label className="label">
                  <span className="label-text">Description</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Chelsea to win, Over 2.5 goals"
                  className="input input-bordered w-full"
                  value={formData.description}
                  onInput={(e) =>
                    handleInputChange(
                      "description",
                      (e.target as HTMLInputElement).value,
                    )
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Line</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="-1.5, 2.5, 0"
                    className="input input-bordered"
                    value={formData.line}
                    onInput={(e) =>
                      handleInputChange(
                        "line",
                        (e.target as HTMLInputElement).value,
                      )
                    }
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Odds</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    placeholder="-150, +200"
                    className="input input-bordered"
                    value={formData.odds}
                    onInput={(e) =>
                      handleInputChange(
                        "odds",
                        (e.target as HTMLInputElement).value,
                      )
                    }
                    required
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Amount ($)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="100.00"
                    className="input input-bordered"
                    value={formData.amount}
                    onInput={(e) =>
                      handleInputChange(
                        "amount",
                        (e.target as HTMLInputElement).value,
                      )
                    }
                    required
                  />
                </div>
              </div>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Bet"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
