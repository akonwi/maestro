import { useState, useEffect } from "preact/hooks";
import { Team } from "../types";
import { addTeam, getAllTeams } from "../utils/database";

export function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      setLoading(true);
      const allTeams = await getAllTeams();
      setTeams(allTeams);
      setError(null);
    } catch (err) {
      setError("Failed to load teams");
      console.error("Error loading teams:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeam = async (e: Event) => {
    e.preventDefault();
    if (newTeamName.trim()) {
      try {
        const newTeam: Team = {
          id: crypto.randomUUID(),
          name: newTeamName.trim(),
          createdAt: new Date(),
        };
        await addTeam(newTeam);
        setTeams((prev) => [...prev, newTeam]);
        setNewTeamName("");
        setShowAddForm(false);
        setError(null);
      } catch (err) {
        setError("Failed to add team");
        console.error("Error adding team:", err);
      }
    }
  };

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Teams</h1>
        <button
          className="btn btn-primary"
          onClick={() =>
            (document.getElementById("form") as HTMLDialogElement).showModal()
          }
        >
          Add
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <dialog id="form" class="modal">
        <div className="card bg-base-100 shadow-xl w-1/4">
          <div className="card-body">
            <h2 className="card-title">New Team</h2>
            <form onSubmit={handleAddTeam} className="space-y-4">
              <div className="form-control">
                <input
                  type="text"
                  className="input input-bordered"
                  value={newTeamName}
                  onInput={(e) =>
                    setNewTeamName((e.target as HTMLInputElement).value)
                  }
                  placeholder="Name"
                  autoFocus
                  required
                />
              </div>
              <div className="card-actions justify-end">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    (
                      document.getElementById("form") as HTMLDialogElement
                    ).close();
                    setNewTeamName("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      </dialog>

      {!loading && teams.length > 0 && (
        <div className="form-control">
          <input
            type="text"
            className="input input-bordered"
            placeholder="Search teams..."
            value={searchTerm}
            onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
          />
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : filteredTeams.length === 0 && searchTerm ? (
        <div className="text-center py-12">
          <div className="text-base-content/60 text-lg">No teams found</div>
          <div className="text-base-content/40 text-sm mt-2">
            Try adjusting your search term
          </div>
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-base-content/60 text-lg">No teams yet</div>
          <div className="text-base-content/40 text-sm mt-2">
            Add your first team to get started
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeams.map((team) => (
            <a href={`/team/${team.id}`}>
              <div
                key={team.id}
                className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow"
              >
                <div className="card-body">
                  <h2 className="card-title">{team.name}</h2>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
