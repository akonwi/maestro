import { db } from "../utils/database";
import { Team } from "../types";
import { TeamMapping, ApiFootballTeam } from "../types/apiFootball";
import { teamService } from "./teamService";

class TeamMappingService {
  private getStorageKey(leagueId: number, season: number): string {
    return `teamMappings_${leagueId}_${season}`;
  }

  saveTeamMappings(leagueId: number, season: number, mappings: TeamMapping[]): void {
    const key = this.getStorageKey(leagueId, season);
    localStorage.setItem(key, JSON.stringify(mappings));
  }

  getTeamMappings(leagueId: number, season: number): TeamMapping[] {
    const key = this.getStorageKey(leagueId, season);
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  async createMappingsFromApiTeams(
    apiTeams: ApiFootballTeam[], 
    localLeagueId: string
  ): Promise<TeamMapping[]> {
    // Get existing local teams for potential matching
    const localTeams = await db.teams.where("leagueId").equals(localLeagueId).toArray();
    
    return apiTeams.map(apiTeam => {
      // Try to find existing team by name similarity
      const potentialMatch = this.findBestTeamMatch(apiTeam.team.name, localTeams);
      
      return {
        apiTeamId: apiTeam.team.id,
        apiTeamName: apiTeam.team.name,
        apiTeamLogo: apiTeam.team.logo,
        localTeamId: potentialMatch?.id || null,
        localTeamName: potentialMatch?.name || apiTeam.team.name,
        leagueId: localLeagueId
      };
    });
  }

  private findBestTeamMatch(apiTeamName: string, localTeams: Team[]): Team | null {
    if (localTeams.length === 0) return null;

    // Exact match first
    const exactMatch = localTeams.find(team => 
      team.name.toLowerCase() === apiTeamName.toLowerCase()
    );
    if (exactMatch) return exactMatch;

    // Partial match (contains or is contained)
    const partialMatch = localTeams.find(team => {
      const teamName = team.name.toLowerCase();
      const apiName = apiTeamName.toLowerCase();
      return teamName.includes(apiName) || apiName.includes(teamName);
    });
    if (partialMatch) return partialMatch;

    // Fuzzy matching for common abbreviations and variations
    const fuzzyMatch = localTeams.find(team => {
      return this.calculateSimilarity(team.name, apiTeamName) > 0.7;
    });

    return fuzzyMatch || null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.getEditDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - editDistance) / longer.length;
  }

  private getEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  async applyTeamMapping(mapping: TeamMapping): Promise<string> {
    if (mapping.localTeamId) {
      // Update existing team name if changed
      if (mapping.localTeamName !== (await db.teams.get(mapping.localTeamId))?.name) {
        await teamService.updateTeam(mapping.localTeamId, { name: mapping.localTeamName });
      }
      return mapping.localTeamId;
    } else {
      // Create new team
      const newTeam = await teamService.createTeam(mapping.localTeamName, mapping.leagueId);
      return newTeam.id;
    }
  }

  async applyAllMappings(mappings: TeamMapping[]): Promise<{ [apiTeamId: number]: string }> {
    const result: { [apiTeamId: number]: string } = {};
    
    for (const mapping of mappings) {
      const localTeamId = await this.applyTeamMapping(mapping);
      result[mapping.apiTeamId] = localTeamId;
    }
    
    return result;
  }

  generateSuggestions(apiTeams: ApiFootballTeam[], localTeams: Team[]): Array<{
    apiTeam: ApiFootballTeam;
    suggestions: Array<{ team: Team; confidence: number }>;
  }> {
    return apiTeams.map(apiTeam => ({
      apiTeam,
      suggestions: localTeams
        .map(localTeam => ({
          team: localTeam,
          confidence: this.calculateSimilarity(apiTeam.team.name, localTeam.name)
        }))
        .filter(suggestion => suggestion.confidence > 0.3)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3) // Top 3 suggestions
    }));
  }

  updateMapping(
    leagueId: number, 
    season: number, 
    apiTeamId: number, 
    localTeamId: string | null, 
    localTeamName: string
  ): void {
    const mappings = this.getTeamMappings(leagueId, season);
    const existingIndex = mappings.findIndex(m => m.apiTeamId === apiTeamId);
    
    if (existingIndex >= 0) {
      mappings[existingIndex].localTeamId = localTeamId;
      mappings[existingIndex].localTeamName = localTeamName;
    }
    
    this.saveTeamMappings(leagueId, season, mappings);
  }

  clearMappings(leagueId: number, season: number): void {
    const key = this.getStorageKey(leagueId, season);
    localStorage.removeItem(key);
  }

  getMappingStats(leagueId: number, season: number): {
    total: number;
    mapped: number;
    unmapped: number;
    newTeams: number;
  } {
    const mappings = this.getTeamMappings(leagueId, season);
    const mapped = mappings.filter(m => m.localTeamId !== null).length;
    const newTeams = mappings.filter(m => m.localTeamId === null).length;
    
    return {
      total: mappings.length,
      mapped: mapped,
      unmapped: 0, // All teams should have either a mapping or be marked for creation
      newTeams: newTeams
    };
  }
}

export const teamMappingService = new TeamMappingService();
