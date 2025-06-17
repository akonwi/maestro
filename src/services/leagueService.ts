import { db } from "../utils/database";
import { League } from "../types";

export const leagueService = {
  async createLeague(name: string): Promise<League> {
    const league: League = {
      id: crypto.randomUUID(),
      name: name.trim(),
    };
    
    await db.leagues.add(league);
    return league;
  },

  async updateLeague(id: string, name: string): Promise<void> {
    await db.leagues.update(id, { name: name.trim() });
  },

  async deleteLeague(id: string): Promise<void> {
    // Check if league has teams or matches
    const teamsCount = await db.teams.where("leagueId").equals(id).count();
    const matchesCount = await db.matches.where("leagueId").equals(id).count();
    
    if (teamsCount > 0 || matchesCount > 0) {
      throw new Error("Cannot delete league with existing teams or matches");
    }
    
    await db.leagues.delete(id);
  },

  async getLeague(id: string): Promise<League | undefined> {
    return await db.leagues.get(id);
  },

  async getAllLeagues(): Promise<League[]> {
    return await db.leagues.orderBy("name").toArray();
  }
};
