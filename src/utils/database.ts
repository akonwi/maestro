import Dexie, { type EntityTable } from 'dexie';
import { Team, Match } from "../types";

// Define the database schema
class MaestroDB extends Dexie {
	teams!: EntityTable<Team, 'id'>;
	matches!: EntityTable<Match, 'id'>;

	constructor() {
		super('Maestro');
		
		this.version(1).stores({
			teams: 'id, name',
			matches: 'id, date, homeId, awayId'
		});
	}
}

export const db = new MaestroDB();
