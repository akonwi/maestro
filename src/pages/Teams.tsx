import { useState } from "preact/hooks";
import { Team } from "../types";
import { db } from "../utils/database";
import { useLiveQuery } from "dexie-react-hooks";
import { isEmpty } from "../utils/helpers";

export function Teams() {
  const [searchTerm, setSearchTerm] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  
  const teams = useLiveQuery(() => {
    if (searchTerm) {
      return db.teams
        .orderBy('name')
        .filter(team => team.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .toArray();
    }
    return db.teams.orderBy('name').toArray();
  }, [searchTerm]);

  const handleAddTeam = async (e: Event) => {
    e.preventDefault();
    if (newTeamName.trim()) {
      const newTeam: Team = {
        id: crypto.randomUUID(),
        name: newTeamName.trim(),
        createdAt: new Date(),
      };
      await db.teams.add(newTeam);
      setNewTeamName("");
      (document.getElementById("form") as HTMLDialogElement).close();
    }
  };



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

      <dialog id="form" class="modal">
        <div className="card bg-base-100 border border-base-300 w-1/4">
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

      {!isEmpty(teams) && (
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

      {teams == null ? (
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : isEmpty(teams) && searchTerm !== "" ? (
        <div className="text-center py-12">
          <div className="text-base-content/60 text-lg">No teams found</div>
          <div className="text-base-content/40 text-sm mt-2">
            Try adjusting your search term
          </div>
        </div>
      ) : isEmpty(teams) ? (
        <div className="text-center py-12">
          <div className="text-base-content/60 text-lg">No teams yet</div>
          <div className="text-base-content/40 text-sm mt-2">
            Add your first team to get started
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams?.map((team) => (
            <a href={`/team/${team.id}`}>
              <div
                key={team.id}
                className="card bg-base-100 border border-base-300 hover:border-primary transition-colors"
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
