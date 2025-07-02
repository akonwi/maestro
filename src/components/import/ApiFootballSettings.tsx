import { useState, useEffect } from "preact/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../utils/database";
import { apiFootballService } from "../../services/apiFootballService";
import { matchImportService } from "../../services/matchImportService";
import { LeagueSelector } from "./LeagueSelector";
import { TeamMappingTable } from "./TeamMappingTable";
import { ImportProgress } from "./ImportProgress";
import { ImportProgress as ImportProgressType, ApiFootballLeague } from "../../types/apiFootball";

export function ApiFootballSettings() {
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    error?: string;
  }>({ tested: false, success: false });

  // Import state
  const [selectedApiLeague, setSelectedApiLeague] = useState<number | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(new Date().getFullYear());
  const [selectedLocalLeague, setSelectedLocalLeague] = useState<string>("");
  const [importProgress, setImportProgress] = useState<ImportProgressType | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [availableSeasons, setAvailableSeasons] = useState<Array<{ year: number; current: boolean }>>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);

  const localLeagues = useLiveQuery(() => db.leagues.orderBy("name").toArray());

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (selectedApiLeague) {
      loadSeasonsForLeague(selectedApiLeague);
    } else {
      setAvailableSeasons([]);
    }
  }, [selectedApiLeague]);

  const loadConfig = () => {
    const config = apiFootballService.getConfig();
    if (config) {
      setSelectedLeagues(config.selectedLeagues);
      
      // Load import preferences
      if (config.importPreferences) {
        setSelectedSeason(config.importPreferences.selectedSeason);
        
        // Set the first mapped league as selected if available
        const mappings = config.importPreferences.leagueMappings;
        const firstApiLeague = Object.keys(mappings).map(Number)[0];
        if (firstApiLeague) {
          setSelectedApiLeague(firstApiLeague);
          setSelectedLocalLeague(mappings[firstApiLeague]);
        }
      }
    }
  };

  const testConnection = async () => {
    try {
      const result = await apiFootballService.testConnection();
      setConnectionStatus({
        tested: true,
        success: result.success,
        error: result.error
      });
    } catch (error) {
      setConnectionStatus({
        tested: true,
        success: false,
        error: error instanceof Error ? error.message : "Connection failed"
      });
    }
  };

  const loadSeasonsForLeague = async (leagueId: number) => {
    setLoadingSeasons(true);
    try {
      const leagues = await apiFootballService.getLeagues(true);
      const league = leagues.find(l => l.league.id === leagueId);
      if (league) {
        const seasons = league.seasons.map(s => ({ year: s.year, current: s.current }));
        setAvailableSeasons(seasons.sort((a, b) => b.year - a.year)); // Most recent first
        
        // Auto-select current season if available
        const currentSeason = seasons.find(s => s.current);
        if (currentSeason) {
          setSelectedSeason(currentSeason.year);
        } else if (seasons.length > 0) {
          setSelectedSeason(seasons[0].year);
        }
      }
    } catch (error) {
      console.error("Failed to load seasons:", error);
      setAvailableSeasons([]);
    } finally {
      setLoadingSeasons(false);
    }
  };

  const handleLeagueSelectionChange = (leagueIds: number[]) => {
    setSelectedLeagues(leagueIds);
    apiFootballService.updateConfig({ selectedLeagues: leagueIds });
  };

  const saveImportPreferences = () => {
    if (!selectedApiLeague || !selectedLocalLeague) return;
    
    const config = apiFootballService.getConfig() || {
      selectedLeagues: [],
      teamMappings: {},
      lastImport: {}
    };

    const currentMappings = config.importPreferences?.leagueMappings || {};
    
    apiFootballService.updateConfig({
      importPreferences: {
        leagueMappings: {
          ...currentMappings,
          [selectedApiLeague]: selectedLocalLeague
        },
        selectedSeason
      }
    });
  };

  const handleApiLeagueChange = (apiLeagueId: number | null) => {
    setSelectedApiLeague(apiLeagueId);
    
    // Load existing mapping for this league if it exists
    const config = apiFootballService.getConfig();
    if (config?.importPreferences?.leagueMappings && apiLeagueId) {
      const existingMapping = config.importPreferences.leagueMappings[apiLeagueId];
      if (existingMapping) {
        setSelectedLocalLeague(existingMapping);
      } else {
        setSelectedLocalLeague("");
      }
    } else {
      setSelectedLocalLeague("");
    }
  };

  const handleLocalLeagueChange = (localLeagueId: string) => {
    setSelectedLocalLeague(localLeagueId);
    
    // Save preferences when both API league and local league are selected
    if (selectedApiLeague && localLeagueId) {
      setTimeout(() => saveImportPreferences(), 0); // Async to ensure state is updated
    }
  };

  const handleSeasonChange = (season: number) => {
    setSelectedSeason(season);
    saveImportPreferences();
  };

  const startImport = async () => {
    if (!selectedApiLeague || !selectedLocalLeague) {
      alert("Please select both API league and local league");
      return;
    }

    // Save current preferences
    saveImportPreferences();

    setIsImporting(true);
    setImportProgress(null);

    // Set up progress tracking
    const handleProgress = (progress: ImportProgressType) => {
      setImportProgress(progress);
    };

    matchImportService.onProgress(handleProgress);

    try {
      const result = await matchImportService.importMatches(
        selectedApiLeague,
        selectedSeason,
        selectedLocalLeague
      );

      alert(`Import completed!\n${result.imported} matches imported\n${result.skipped} matches skipped\n${result.errors.length} errors`);
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      matchImportService.removeProgressCallback(handleProgress);
      setIsImporting(false);
      setImportProgress(null);
    }
  };



  return (
    <div class="space-y-6">
      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <h2 class="card-title">API Configuration</h2>
          
          <div class="flex justify-between items-center">
            <div>
              <h3 class="text-lg font-medium">API Football Integration</h3>
              <p class="text-sm text-base-content/60">
                Import match data automatically from API-Football
              </p>
            </div>
            <button 
              class="btn btn-outline"
              onClick={testConnection}
            >
              Test Connection
            </button>
          </div>

          {connectionStatus.tested && (
            <div class={`alert ${connectionStatus.success ? "alert-success" : "alert-error"}`}>
              {connectionStatus.success ? (
                <span>✓ Connection successful!</span>
              ) : (
                <span>✗ {connectionStatus.error}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {apiFootballService.isConfigured() && (
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">League Selection</h2>
            <LeagueSelector
              selectedLeagues={selectedLeagues}
              onSelectionChange={handleLeagueSelectionChange}
            />
          </div>
        </div>
      )}

      {selectedLeagues.length > 0 && localLeagues && localLeagues.length > 0 && (
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">Import Matches</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="form-control">
                <label class="label">
                  <span class="label-text">API League</span>
                </label>
                <select
                  class="select select-bordered"
                  value={selectedApiLeague || ""}
                  onChange={(e) => handleApiLeagueChange(Number((e.target as HTMLSelectElement).value) || null)}
                >
                  <option value="">Select API League</option>
                  {selectedLeagues.map(leagueId => (
                    <option key={leagueId} value={leagueId}>
                      League {leagueId}
                    </option>
                  ))}
                </select>
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text">Season</span>
                </label>
                <select
                  class="select select-bordered"
                  value={selectedSeason}
                  onChange={(e) => handleSeasonChange(Number((e.target as HTMLSelectElement).value))}
                  disabled={loadingSeasons || availableSeasons.length === 0}
                >
                  {loadingSeasons ? (
                    <option value="">Loading seasons...</option>
                  ) : availableSeasons.length === 0 ? (
                    <option value="">Select a league first</option>
                  ) : (
                    availableSeasons.map(season => (
                      <option key={season.year} value={season.year}>
                        {season.year} {season.current ? "(Current)" : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div class="form-control">
                <label class="label">
                  <span class="label-text">Local League</span>
                </label>
                <select
                  class="select select-bordered"
                  value={selectedLocalLeague}
                  onChange={(e) => handleLocalLeagueChange((e.target as HTMLSelectElement).value)}
                >
                  <option value="">Select Local League</option>
                  {localLeagues.map(league => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedApiLeague && selectedLocalLeague && (
              <div class="mt-6">
                <TeamMappingTable
                  apiLeagueId={selectedApiLeague}
                  season={selectedSeason}
                  localLeagueId={selectedLocalLeague}
                />
                
                <div class="mt-4 flex justify-end">
                  <button
                    class="btn btn-primary"
                    onClick={startImport}
                    disabled={isImporting}
                  >
                    {isImporting ? "Importing..." : "Import Matches"}
                  </button>
                </div>
              </div>
            )}

            {importProgress && (
              <div class="mt-4">
                <ImportProgress progress={importProgress} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
