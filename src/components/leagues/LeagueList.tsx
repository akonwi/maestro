import { useState } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../utils/database";
import { leagueService } from "../../services/leagueService";
import { League } from "../../types";

export function LeagueList() {
  const leagues = useLiveQuery(() => db.leagues.orderBy("name").toArray());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const startEdit = (league: League) => {
    setEditingId(league.id);
    setEditName(league.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) return;
    
    try {
      await leagueService.updateLeague(id, editName);
      setEditingId(null);
      setEditName("");
    } catch (error) {
      console.error("Failed to update league:", error);
    }
  };

  const handleDelete = async (league: League) => {
    if (!confirm(`Are you sure you want to delete "${league.name}"?`)) return;
    
    try {
      await leagueService.deleteLeague(league.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete league");
    }
  };

  if (!leagues) return <div class="loading loading-spinner"></div>;

  if (leagues.length === 0) {
    return (
      <div class="text-center py-8 text-base-content/60">
        No leagues created yet
      </div>
    );
  }

  return (
    <div class="space-y-2">
      {leagues.map((league) => (
        <div key={league.id} class="card bg-base-100 shadow-sm">
          <div class="card-body py-4">
            {editingId === league.id ? (
              <div class="flex gap-2 items-center">
                <input
                  type="text"
                  class="input input-bordered input-sm flex-1"
                  value={editName}
                  onInput={(e) => setEditName((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(league.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  autoFocus
                />
                <button
                  class="btn btn-sm btn-primary"
                  onClick={() => saveEdit(league.id)}
                  disabled={!editName.trim()}
                >
                  Save
                </button>
                <button
                  class="btn btn-sm btn-ghost"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div class="flex justify-between items-center">
                <h3 class="font-semibold">{league.name}</h3>
                <div class="flex gap-2">
                  <button
                    class="btn btn-sm btn-ghost"
                    onClick={() => startEdit(league)}
                  >
                    Edit
                  </button>
                  <button
                    class="btn btn-sm btn-error btn-outline"
                    onClick={() => handleDelete(league)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
