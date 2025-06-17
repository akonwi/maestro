import { db } from "../utils/database";
import { Team } from "../types";

export const teamService = {
  async createTeam(name: string, leagueId: string): Promise<Team> {
    const team: Team = {
      id: crypto.randomUUID(),
      name: name.trim(),
      leagueId,
      createdAt: new Date(),
    };
    
    await db.teams.add(team);
    return team;
  },

  async updateTeam(id: string, updates: Partial<Pick<Team, "name" | "leagueId">>): Promise<void> {
    const updateData: Partial<Team> = {};
    
    if (updates.name !== undefined) {
      updateData.name = updates.name.trim();
    }
    
    if (updates.leagueId !== undefined) {
      updateData.leagueId = updates.leagueId;
    }
    
    await db.teams.update(id, updateData);
  },

  async deleteTeam(id: string): Promise<void> {
    // Check if team has matches
    const matchesCount = await db.matches.where("homeId").equals(id).or("awayId").equals(id).count();
    
    if (matchesCount > 0) {
      throw new Error("Cannot delete team with existing matches");
    }
    
    await db.teams.delete(id);
  },

  async getTeam(id: string): Promise<Team | undefined> {
    return await db.teams.get(id);
  },

  async getAllTeams(): Promise<Team[]> {
    return await db.teams.orderBy("name").toArray();
  },

  async getTeamsByLeague(leagueId: string): Promise<Team[]> {
    return await db.teams.where("leagueId").equals(leagueId).sortBy("name");
  }
};
