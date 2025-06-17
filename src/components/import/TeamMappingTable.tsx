import { useState, useEffect } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../utils/database";
import { TeamMapping, ApiFootballTeam } from "../../types/apiFootball";
import { Team } from "../../types";
import { teamMappingService } from "../../services/teamMappingService";
import { apiFootballService } from "../../services/apiFootballService";

interface TeamMappingTableProps {
  apiLeagueId: number;
  season: number;
  localLeagueId: string;
  onMappingChange?: () => void;
}

export function TeamMappingTable({ 
  apiLeagueId, 
  season, 
  localLeagueId, 
  onMappingChange 
}: TeamMappingTableProps) {
  const [mappings, setMappings] = useState<TeamMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiTeams, setApiTeams] = useState<ApiFootballTeam[]>([]);

  // Get local teams for the selected league
  const localTeams = useLiveQuery(() => 
    db.teams.where("leagueId").equals(localLeagueId).toArray()
  );

  useEffect(() => {
    loadTeamMappings();
  }, [apiLeagueId, season, localLeagueId]);

  const loadTeamMappings = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load API teams
      const teams = await apiFootballService.getTeams(apiLeagueId, season);
      setApiTeams(teams);

      // Check if mappings already exist
      let existingMappings = teamMappingService.getTeamMappings(apiLeagueId, season);
      
      if (existingMappings.length === 0) {
        // Create initial mappings with suggestions
        existingMappings = await teamMappingService.createMappingsFromApiTeams(teams, localLeagueId);
        teamMappingService.saveTeamMappings(apiLeagueId, season, existingMappings);
      }

      setMappings(existingMappings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team mappings");
      console.error("Failed to load team mappings:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (apiTeamId: number, localTeamId: string | null, localTeamName: string) => {
    const updatedMappings = mappings.map(mapping => 
      mapping.apiTeamId === apiTeamId 
        ? { ...mapping, localTeamId, localTeamName }
        : mapping
    );
    
    setMappings(updatedMappings);
    teamMappingService.saveTeamMappings(apiLeagueId, season, updatedMappings);
    onMappingChange?.();
  };

  const handleLocalTeamChange = (apiTeamId: number, localTeamId: string) => {
    if (localTeamId === "new") {
      // Create new team
      const apiTeam = mappings.find(m => m.apiTeamId === apiTeamId);
      updateMapping(apiTeamId, null, apiTeam?.apiTeamName || "");
    } else {
      // Map to existing team
      const localTeam = localTeams?.find(t => t.id === localTeamId);
      updateMapping(apiTeamId, localTeamId, localTeam?.name || "");
    }
  };

  const handleNewTeamNameChange = (apiTeamId: number, newName: string) => {
    updateMapping(apiTeamId, null, newName);
  };

  const generateSuggestions = () => {
    if (!localTeams) return;

    const suggestions = teamMappingService.generateSuggestions(apiTeams, localTeams);
    const updatedMappings = mappings.map(mapping => {
      const suggestion = suggestions.find(s => s.apiTeam.team.id === mapping.apiTeamId);
      if (suggestion && suggestion.suggestions.length > 0 && suggestion.suggestions[0].confidence > 0.8) {
        const bestMatch = suggestion.suggestions[0];
        return {
          ...mapping,
          localTeamId: bestMatch.team.id,
          localTeamName: bestMatch.team.name
        };
      }
      return mapping;
    });

    setMappings(updatedMappings);
    teamMappingService.saveTeamMappings(apiLeagueId, season, updatedMappings);
    onMappingChange?.();
  };

  const stats = teamMappingService.getMappingStats(apiLeagueId, season);

  if (loading) {
    return (
      <div class="flex justify-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div class="alert alert-error">
        <span>{error}</span>
        <button class="btn btn-sm" onClick={loadTeamMappings}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <div>
          <h3 class="text-lg font-semibold">Team Mappings</h3>
          <div class="text-sm text-base-content/60">
            {stats.mapped} mapped • {stats.newTeams} new teams • {stats.total} total
          </div>
        </div>
        <div class="flex gap-2">
          <button 
            class="btn btn-sm btn-outline"
            onClick={generateSuggestions}
            disabled={!localTeams || localTeams.length === 0}
          >
            Auto-Suggest
          </button>
          <button 
            class="btn btn-sm btn-outline"
            onClick={loadTeamMappings}
          >
            Refresh
          </button>
        </div>
      </div>

      {mappings.length === 0 ? (
        <div class="text-center py-8 text-base-content/60">
          No teams found for this league
        </div>
      ) : (
        <div class="overflow-x-auto">
          <table class="table table-zebra">
            <thead>
              <tr>
                <th>API Team</th>
                <th>Local Team</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.apiTeamId}>
                  <td>
                    <div class="flex items-center gap-3">
                      <img 
                        src={mapping.apiTeamLogo} 
                        alt={mapping.apiTeamName}
                        class="w-8 h-8 object-contain"
                      />
                      <span class="font-medium">{mapping.apiTeamName}</span>
                    </div>
                  </td>
                  <td>
                    {mapping.localTeamId ? (
                      <div class="flex items-center gap-2">
                        <span class="badge badge-success">Mapped</span>
                        <span>{mapping.localTeamName}</span>
                      </div>
                    ) : (
                      <div class="flex items-center gap-2">
                        <span class="badge badge-warning">New Team</span>
                        <input
                          type="text"
                          class="input input-sm input-bordered"
                          value={mapping.localTeamName}
                          onInput={(e) => 
                            handleNewTeamNameChange(
                              mapping.apiTeamId, 
                              (e.target as HTMLInputElement).value
                            )
                          }
                          placeholder="Team name"
                        />
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      class="select select-sm select-bordered"
                      value={mapping.localTeamId || "new"}
                      onChange={(e) => 
                        handleLocalTeamChange(
                          mapping.apiTeamId, 
                          (e.target as HTMLSelectElement).value
                        )
                      }
                    >
                      <option value="new">Create New Team</option>
                      {localTeams?.map((team) => (
                        <option key={team.id} value={team.id}>
                          Map to: {team.name}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stats.total > 0 && (
        <div class="bg-base-200 p-4 rounded-lg">
          <div class="text-sm">
            <div class="font-medium mb-2">Mapping Summary</div>
            <div class="grid grid-cols-3 gap-4">
              <div class="text-center">
                <div class="text-lg font-bold text-success">{stats.mapped}</div>
                <div class="text-xs">Mapped to Existing</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold text-warning">{stats.newTeams}</div>
                <div class="text-xs">New Teams</div>
              </div>
              <div class="text-center">
                <div class="text-lg font-bold">{stats.total}</div>
                <div class="text-xs">Total Teams</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
