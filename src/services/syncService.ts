import { db, CURRENT_DB_VERSION } from "../utils/database";
import { isEmpty } from "../utils/helpers";

export interface SyncConfig {
	githubToken: string;
	repoOwner: string;
	repoName: string;
	filePath: string;
}

export interface SyncStatus {
	lastSync: Date | null;
	syncInProgress: boolean;
	lastError: string | null;
}

// Get sync config from localStorage
export const getSyncConfig = (): SyncConfig | null => {
	const config = localStorage.getItem("maestro_sync_config");
	return config ? JSON.parse(config) : null;
};

// Save sync config to localStorage
export const setSyncConfig = (config: SyncConfig): void => {
	localStorage.setItem("maestro_sync_config", JSON.stringify(config));
};

// Get sync status from localStorage
export const getSyncStatus = (): SyncStatus => {
	const status = localStorage.getItem("maestro_sync_status");
	if (status) {
		const parsed = JSON.parse(status);
		return {
			...parsed,
			lastSync: parsed.lastSync ? new Date(parsed.lastSync) : null,
		};
	}
	return {
		lastSync: null,
		syncInProgress: false,
		lastError: null,
	};
};

// Save sync status to localStorage
const setSyncStatus = (status: SyncStatus): void => {
	localStorage.setItem("maestro_sync_status", JSON.stringify(status));
};

// Export all data as JSON
export const exportAllData = async () => {
	const [leagues, teams, matches, bets] = await Promise.all([
		db.leagues.toArray(),
		db.teams.toArray(),
		db.matches.toArray(),
		db.bets.toArray(),
	]);

	return {
		dbVersion: CURRENT_DB_VERSION,
		exported: new Date().toISOString(),
		data: { leagues, teams, matches, bets },
	};
};

// Import data from JSON
export const importAllData = async (exportedData: any) => {
	if (!exportedData.data) {
		throw new Error("Invalid data format");
	}

	// Check database version compatibility
	if (exportedData.dbVersion && exportedData.dbVersion > CURRENT_DB_VERSION) {
		throw new Error(
			`Data was exported from a newer version (DB v${exportedData.dbVersion}). ` +
				`Current version is v${CURRENT_DB_VERSION}. Please update the app to import this data.`,
		);
	}

	if (exportedData.dbVersion && exportedData.dbVersion < CURRENT_DB_VERSION) {
		console.warn(
			`Importing data from older version (DB v${exportedData.dbVersion}). ` +
				`Current version is v${CURRENT_DB_VERSION}. Data will be migrated.`,
		);
	}

	const { leagues, teams, matches, bets } = exportedData.data;

	const processTeams =
		teams?.map((team: any) => ({
			...team,
			createdAt: new Date(team.createdAt),
		})) || [];

	const processMatches =
		matches?.map((match: any) => ({
			...match,
			createdAt: new Date(match.createdAt),
		})) || [];

	// Handle missing bets table for DB version 1 imports
	const processBets =
		bets?.map((bet: any) => ({
			...bet,
			createdAt: new Date(bet.createdAt),
		})) || [];

	await db.transaction(
		"rw",
		[db.leagues, db.teams, db.matches, db.bets],
		async () => {
			// Clear existing data
			await db.leagues.clear();
			await db.teams.clear();
			await db.matches.clear();
			await db.bets.clear();

			// Import new data with proper Date objects
			if (!isEmpty(leagues)) await db.leagues.bulkAdd(leagues);
			if (!isEmpty(processTeams)) await db.teams.bulkAdd(processTeams);
			if (!isEmpty(processMatches)) await db.matches.bulkAdd(processMatches);
			if (!isEmpty(processBets)) await db.bets.bulkAdd(processBets);
		},
	);
};

// Test GitHub API connection
export const testGitHubConnection = async (
	config: SyncConfig,
): Promise<boolean> => {
	try {
		const response = await fetch(
			`https://api.github.com/repos/${config.repoOwner}/${config.repoName}`,
			{
				headers: {
					Authorization: `token ${config.githubToken}`,
					Accept: "application/vnd.github.v3+json",
				},
			},
		);

		return response.ok;
	} catch (error) {
		console.error("GitHub connection test failed:", error);
		return false;
	}
};

// Get file from GitHub
const getFileFromGitHub = async (config: SyncConfig) => {
	const response = await fetch(
		`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${config.filePath}`,
		{
			headers: {
				Authorization: `token ${config.githubToken}`,
				Accept: "application/vnd.github.v3+json",
			},
		},
	);

	if (response.status === 404) {
		return null; // File doesn't exist yet
	}

	if (!response.ok) {
		throw new Error(`GitHub API error: ${response.statusText}`);
	}

	const fileData = await response.json();
	const content = JSON.parse(atob(fileData.content));

	return { content, sha: fileData.sha };
};

// Save file to GitHub
const saveFileToGitHub = async (
	config: SyncConfig,
	data: any,
	sha?: string,
) => {
	const content = btoa(JSON.stringify(data, null, 2));

	const body: any = {
		message: `Sync Maestro data - ${new Date().toISOString()}`,
		content,
	};

	if (sha) {
		body.sha = sha; // Required for updates
	}

	const response = await fetch(
		`https://api.github.com/repos/${config.repoOwner}/${config.repoName}/contents/${config.filePath}`,
		{
			method: "PUT",
			headers: {
				Authorization: `token ${config.githubToken}`,
				Accept: "application/vnd.github.v3+json",
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		},
	);

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(
			`GitHub API error: ${errorData.message || response.statusText}`,
		);
	}

	return await response.json();
};

// Sync data to GitHub
export const syncToGitHub = async (): Promise<void> => {
	const config = getSyncConfig();
	if (!config) {
		throw new Error("Sync not configured. Please set up GitHub sync first.");
	}

	// Set sync in progress
	setSyncStatus({
		...getSyncStatus(),
		syncInProgress: true,
		lastError: null,
	});

	try {
		// Export local data
		const localData = await exportAllData();

		// Get existing file (if any)
		const existingFile = await getFileFromGitHub(config);

		// Save to GitHub
		await saveFileToGitHub(config, localData, existingFile?.sha);

		// Update sync status
		setSyncStatus({
			lastSync: new Date(),
			syncInProgress: false,
			lastError: null,
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		setSyncStatus({
			...getSyncStatus(),
			syncInProgress: false,
			lastError: errorMessage,
		});
		throw error;
	}
};

// Sync data from GitHub
export const syncFromGitHub = async (): Promise<void> => {
	const config = getSyncConfig();
	if (!config) {
		throw new Error("Sync not configured. Please set up GitHub sync first.");
	}

	// Set sync in progress
	setSyncStatus({
		...getSyncStatus(),
		syncInProgress: true,
		lastError: null,
	});

	try {
		// Get file from GitHub
		const fileData = await getFileFromGitHub(config);

		if (!fileData) {
			throw new Error("No data found in GitHub repository");
		}

		// Import the data
		await importAllData(fileData.content);

		// Update sync status
		setSyncStatus({
			lastSync: new Date(),
			syncInProgress: false,
			lastError: null,
		});
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		setSyncStatus({
			...getSyncStatus(),
			syncInProgress: false,
			lastError: errorMessage,
		});
		throw error;
	}
};

// Manual export to file
export const exportToFile = async (): Promise<void> => {
	const data = await exportAllData();
	const blob = new Blob([JSON.stringify(data, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = `maestro-data-${new Date().toISOString().split("T")[0]}.json`;
	a.click();

	URL.revokeObjectURL(url);
};

// Manual import from file
export const importFromFile = async (file: File): Promise<void> => {
	const text = await file.text();
	const data = JSON.parse(text);
	await importAllData(data);
};
