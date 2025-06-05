import { Team, Match } from "../types";

const DB_NAME = "Maestro";
const DB_VERSION = 1;

export const STORES = {
	TEAMS: "teams",
	MATCHES: "matches",
} as const;

let db: IDBDatabase | null = null;

export function initDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (db) {
			resolve(db);
			return;
		}

		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => {
			reject(new Error("Failed to open database"));
		};

		request.onsuccess = () => {
			db = request.result;
			resolve(db);
		};

		request.onupgradeneeded = (event) => {
			const database = (event.target as IDBOpenDBRequest).result;

			// Create teams store
			if (!database.objectStoreNames.contains(STORES.TEAMS)) {
				const teamsStore = database.createObjectStore(STORES.TEAMS, {
					keyPath: "id",
				});
				teamsStore.createIndex("name", "name", { unique: false });
			}

			// Create matches store
			if (!database.objectStoreNames.contains(STORES.MATCHES)) {
				const matchesStore = database.createObjectStore(STORES.MATCHES, {
					keyPath: "id",
				});
				matchesStore.createIndex("date", "date", { unique: false });
				matchesStore.createIndex("homeId", "homeId", { unique: false });
				matchesStore.createIndex("awayId", "awayId", { unique: false });
			}
		};
	});
}

// Team CRUD operations
export async function addTeam(team: Team): Promise<void> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.TEAMS], "readwrite");
	const store = transaction.objectStore(STORES.TEAMS);

	return new Promise((resolve, reject) => {
		const request = store.add(team);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error("Failed to add team"));
	});
}

export async function getAllTeams(): Promise<Team[]> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.TEAMS], "readonly");
	const store = transaction.objectStore(STORES.TEAMS);

	return new Promise((resolve, reject) => {
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error("Failed to get teams"));
	});
}

export async function getTeamById(id: string): Promise<Team | undefined> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.TEAMS], "readonly");
	const store = transaction.objectStore(STORES.TEAMS);

	return new Promise((resolve, reject) => {
		const request = store.get(id);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error("Failed to get team"));
	});
}

export async function updateTeam(team: Team): Promise<void> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.TEAMS], "readwrite");
	const store = transaction.objectStore(STORES.TEAMS);

	return new Promise((resolve, reject) => {
		const request = store.put(team);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error("Failed to update team"));
	});
}

export async function deleteTeam(id: string): Promise<void> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.TEAMS], "readwrite");
	const store = transaction.objectStore(STORES.TEAMS);

	return new Promise((resolve, reject) => {
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error("Failed to delete team"));
	});
}

// Match CRUD operations
export async function addMatch(match: Match): Promise<void> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.MATCHES], "readwrite");
	const store = transaction.objectStore(STORES.MATCHES);

	return new Promise((resolve, reject) => {
		const request = store.add(match);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error("Failed to add match"));
	});
}

export async function getAllMatches(): Promise<Match[]> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.MATCHES], "readonly");
	const store = transaction.objectStore(STORES.MATCHES);

	return new Promise((resolve, reject) => {
		const request = store.getAll();
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error("Failed to get matches"));
	});
}

export async function getMatchById(id: string): Promise<Match | undefined> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.MATCHES], "readonly");
	const store = transaction.objectStore(STORES.MATCHES);

	return new Promise((resolve, reject) => {
		const request = store.get(id);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(new Error("Failed to get match"));
	});
}

export async function getMatchesByTeam(teamId: string): Promise<Match[]> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.MATCHES], "readonly");
	const store = transaction.objectStore(STORES.MATCHES);

	const getHomeMatches = (): Promise<Match[]> => {
		return new Promise((resolve, reject) => {
			const homeIndex = store.index("homeId");
			const homeRequest = homeIndex.getAll(teamId);
			homeRequest.onsuccess = () => resolve(homeRequest.result);
			homeRequest.onerror = () => reject(new Error("Failed to get home matches"));
		});
	};

	const getAwayMatches = (): Promise<Match[]> => {
		return new Promise((resolve, reject) => {
			const awayIndex = store.index("awayId");
			const awayRequest = awayIndex.getAll(teamId);
			awayRequest.onsuccess = () => resolve(awayRequest.result);
			awayRequest.onerror = () => reject(new Error("Failed to get away matches"));
		});
	};

	const [homeMatches, awayMatches] = await Promise.all([getHomeMatches(), getAwayMatches()]);
	return [...homeMatches, ...awayMatches];
}

export async function deleteMatch(id: string): Promise<void> {
	const database = await initDatabase();
	const transaction = database.transaction([STORES.MATCHES], "readwrite");
	const store = transaction.objectStore(STORES.MATCHES);

	return new Promise((resolve, reject) => {
		const request = store.delete(id);
		request.onsuccess = () => resolve();
		request.onerror = () => reject(new Error("Failed to delete match"));
	});
}
