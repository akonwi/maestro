import Dexie, { type EntityTable } from "dexie";
import { League, Team, Match } from "../types";
import { Bet } from "../services/betService";

// Current database version
export const CURRENT_DB_VERSION = 3;

// Define the database schema
class MaestroDB extends Dexie {
	leagues!: EntityTable<League, "id">;
	teams!: EntityTable<Team, "id">;
	matches!: EntityTable<Match, "id">;
	bets!: EntityTable<Bet, "id">;

	constructor() {
		super("Maestro");

		this.version(1).stores({
			teams: "id, name",
			matches: "id, date, homeId, awayId",
		});

		this.version(2).stores({
			teams: "id, name",
			matches: "id, date, homeId, awayId",
			bets: "id, matchId, createdAt, result",
		});

		this.version(3).stores({
			leagues: "id, name",
			teams: "id, name, leagueId",
			matches: "id, date, homeId, awayId, leagueId",
			bets: "id, matchId, createdAt, result",
		}).upgrade(async (tx) => {
			// Create default MLS league for existing data
			const mlsLeagueId = crypto.randomUUID();
			await tx.table("leagues").add({
				id: mlsLeagueId,
				name: "MLS"
			});

			// Update all existing teams to belong to MLS league
			const teams = await tx.table("teams").toArray();
			for (const team of teams) {
				await tx.table("teams").update(team.id, { leagueId: mlsLeagueId });
			}

			// Update all existing matches to belong to MLS league
			const matches = await tx.table("matches").toArray();
			for (const match of matches) {
				await tx.table("matches").update(match.id, { leagueId: mlsLeagueId });
			}
		});
	}
}

export const db = new MaestroDB();
