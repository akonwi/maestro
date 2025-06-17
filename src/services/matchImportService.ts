import { db } from "../utils/database";
import { Match } from "../types";
import { ApiFootballMatch, ImportProgress } from "../types/apiFootball";
import { apiFootballService } from "./apiFootballService";
import { teamMappingService } from "./teamMappingService";

class MatchImportService {
  private progressCallbacks: Array<(progress: ImportProgress) => void> = [];

  onProgress(callback: (progress: ImportProgress) => void): void {
    this.progressCallbacks.push(callback);
  }

  removeProgressCallback(callback: (progress: ImportProgress) => void): void {
    this.progressCallbacks = this.progressCallbacks.filter(cb => cb !== callback);
  }

  private notifyProgress(progress: ImportProgress): void {
    this.progressCallbacks.forEach(callback => callback(progress));
  }

  async importMatches(
    apiLeagueId: number, 
    season: number, 
    localLeagueId: string
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;

    try {
      // Get team mappings
      const mappings = teamMappingService.getTeamMappings(apiLeagueId, season);
      if (mappings.length === 0) {
        throw new Error("No team mappings found. Please configure team mappings first.");
      }

      // Create mapping lookup
      const teamMappingLookup: { [apiTeamId: number]: string } = {};
      for (const mapping of mappings) {
        if (mapping.localTeamId) {
          teamMappingLookup[mapping.apiTeamId] = mapping.localTeamId;
        } else {
          // Apply mapping to create new team
          const localTeamId = await teamMappingService.applyTeamMapping(mapping);
          teamMappingLookup[mapping.apiTeamId] = localTeamId;
        }
      }

      this.notifyProgress({
        total: 0,
        completed: 0,
        current: "Fetching matches from API...",
        errors: []
      });

      // Fetch completed matches from API
      const apiMatches = await apiFootballService.getFixtures(apiLeagueId, season, "FT");
      
      this.notifyProgress({
        total: apiMatches.length,
        completed: 0,
        current: `Processing ${apiMatches.length} matches...`,
        errors: []
      });

      // Process each match
      for (let i = 0; i < apiMatches.length; i++) {
        const apiMatch = apiMatches[i];
        
        this.notifyProgress({
          total: apiMatches.length,
          completed: i,
          current: `Processing: ${apiMatch.teams.home.name} vs ${apiMatch.teams.away.name}`,
          errors: []
        });

        try {
          const result = await this.processMatch(apiMatch, teamMappingLookup, localLeagueId);
          if (result.imported) {
            imported++;
          } else {
            skipped++;
          }
        } catch (error) {
          const errorMsg = `Failed to import ${apiMatch.teams.home.name} vs ${apiMatch.teams.away.name}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`;
          errors.push(errorMsg);
          console.error(errorMsg, error);
        }
      }

      this.notifyProgress({
        total: apiMatches.length,
        completed: apiMatches.length,
        current: `Completed: ${imported} imported, ${skipped} skipped`,
        errors
      });

      // Update last import timestamp
      apiFootballService.updateConfig({
        lastImport: {
          ...apiFootballService.getConfig()?.lastImport,
          [apiLeagueId]: new Date()
        }
      });

      return { imported, skipped, errors };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      errors.push(errorMsg);
      
      this.notifyProgress({
        total: 0,
        completed: 0,
        current: "Import failed",
        errors
      });

      throw error;
    }
  }

  private async processMatch(
    apiMatch: ApiFootballMatch, 
    teamMappingLookup: { [apiTeamId: number]: string },
    localLeagueId: string
  ): Promise<{ imported: boolean }> {
    // Check if match already exists
    const existingMatch = await this.findExistingMatch(apiMatch, teamMappingLookup, localLeagueId);
    if (existingMatch) {
      return { imported: false };
    }

    // Validate team mappings
    const homeTeamId = teamMappingLookup[apiMatch.teams.home.id];
    const awayTeamId = teamMappingLookup[apiMatch.teams.away.id];

    if (!homeTeamId || !awayTeamId) {
      throw new Error(`Missing team mapping for ${apiMatch.teams.home.name} or ${apiMatch.teams.away.name}`);
    }

    // Validate scores
    if (apiMatch.goals.home === null || apiMatch.goals.away === null) {
      throw new Error("Match has null scores");
    }

    // Create local match
    const localMatch: Match = {
      id: crypto.randomUUID(),
      date: new Date(apiMatch.fixture.date).toISOString().split('T')[0], // Format as YYYY-MM-DD
      homeId: homeTeamId,
      awayId: awayTeamId,
      homeScore: apiMatch.goals.home,
      awayScore: apiMatch.goals.away,
      leagueId: localLeagueId,
      createdAt: new Date()
    };

    await db.matches.add(localMatch);
    return { imported: true };
  }

  private async findExistingMatch(
    apiMatch: ApiFootballMatch,
    teamMappingLookup: { [apiTeamId: number]: string },
    localLeagueId: string
  ): Promise<Match | null> {
    const homeTeamId = teamMappingLookup[apiMatch.teams.home.id];
    const awayTeamId = teamMappingLookup[apiMatch.teams.away.id];
    const matchDate = new Date(apiMatch.fixture.date).toISOString().split('T')[0];

    if (!homeTeamId || !awayTeamId) return null;

    // Look for match with same teams, date, and league
    const existingMatches = await db.matches
      .where("leagueId").equals(localLeagueId)
      .and(match => 
        match.date === matchDate &&
        match.homeId === homeTeamId &&
        match.awayId === awayTeamId
      )
      .toArray();

    return existingMatches.length > 0 ? existingMatches[0] : null;
  }

  async getImportHistory(): Promise<Array<{
    leagueId: number;
    lastImport: Date;
    status: "success" | "partial" | "failed";
  }>> {
    const config = apiFootballService.getConfig();
    if (!config?.lastImport) return [];

    return Object.entries(config.lastImport).map(([leagueId, date]) => ({
      leagueId: parseInt(leagueId),
      lastImport: new Date(date),
      status: "success" as const // TODO: Track actual status
    }));
  }

  async estimateImportSize(apiLeagueId: number, season: number): Promise<{
    totalMatches: number;
    alreadyImported: number;
    toBeImported: number;
  }> {
    try {
      const apiMatches = await apiFootballService.getFixtures(apiLeagueId, season, "FT");
      
      // This is a rough estimate - we'd need to check each match individually for exact count
      const mappings = teamMappingService.getTeamMappings(apiLeagueId, season);
      const hasMappings = mappings.length > 0;
      
      // If no mappings, nothing can be imported yet
      if (!hasMappings) {
        return {
          totalMatches: apiMatches.length,
          alreadyImported: 0,
          toBeImported: 0
        };
      }

      // For now, assume no matches are imported - this could be optimized
      return {
        totalMatches: apiMatches.length,
        alreadyImported: 0,
        toBeImported: apiMatches.length
      };
    } catch (error) {
      console.error("Failed to estimate import size:", error);
      return {
        totalMatches: 0,
        alreadyImported: 0,
        toBeImported: 0
      };
    }
  }
}

export const matchImportService = new MatchImportService();
