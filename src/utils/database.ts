import Dexie, { type EntityTable } from "dexie";
import { Team, Match } from "../types";
import { Bet } from "../services/betService";

// Current database version
export const CURRENT_DB_VERSION = 2;

// Define the database schema
class MaestroDB extends Dexie {
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
	}
}

export const db = new MaestroDB();
