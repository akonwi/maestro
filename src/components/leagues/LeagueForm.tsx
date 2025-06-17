import { useState } from "preact/hooks";
import { leagueService } from "../../services/leagueService";

interface LeagueFormProps {
  onSuccess?: () => void;
}

export function LeagueForm({ onSuccess }: LeagueFormProps) {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await leagueService.createLeague(name);
      setName("");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create league:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} class="flex gap-2">
      <input
        type="text"
        placeholder="Enter league name"
        class="input input-bordered flex-1"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
        disabled={isSubmitting}
        required
      />
      <button
        type="submit"
        class="btn btn-primary"
        disabled={!name.trim() || isSubmitting}
      >
        {isSubmitting ? "Creating..." : "Create League"}
      </button>
    </form>
  );
}
