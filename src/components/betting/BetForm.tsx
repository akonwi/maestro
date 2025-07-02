import { useState } from "preact/hooks";
import { createBet, validateBet } from "../../services/betService";

interface BetFormProps {
  matchId: string;
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: field === "description" ? value : Number(value),
    }));
    setErrors([]);
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);

    const betData = {
      matchId,
      ...formData,
    };

    const validationErrors = validateBet(betData);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      await createBet(betData);
      onBetCreated();
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Failed to create bet",
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl">
        <h3 className="font-bold text-lg mb-4">Record New Bet</h3>

        {errors.length > 0 && (
          <div className="alert alert-error mb-4">
            <ul>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
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

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Line (decimal format)</span>
              </label>
              <input
                type="number"
                step="0.5"
                placeholder="e.g., -1.5, 2.5, 0"
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
                <span className="label-text">Odds (American format, +100)</span>
              </label>
              <input
                type="number"
                step="1"
                placeholder="e.g., -150, +200"
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
          </div>

          <div className="form-control w-full mb-6">
            <div class="flex flex-col">
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
      </div>
    </div>
  );
}
