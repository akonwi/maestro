import {
	ApiFootballResponse,
	ApiFootballLeague,
	ApiFootballTeam,
	ApiFootballMatch,
	ApiFootballConfig,
	CachedApiData,
} from "../types/apiFootball";

const API_BASE_URL = "https://v3.football.api-sports.io";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

class ApiFootballService {
	private cache: CachedApiData = {
		leagues: null,
		teams: {},
		fixtures: {},
	};

	getConfig(): ApiFootballConfig | null {
		const config = localStorage.getItem("apiFootballConfig");
		return config ? JSON.parse(config) : null;
	}

	private saveConfig(config: ApiFootballConfig): void {
		localStorage.setItem("apiFootballConfig", JSON.stringify(config));
	}

	private async makeRequest<T>(
		endpoint: string,
		params: Record<string, string> = {},
	): Promise<T[]> {
		const config = this.getConfig();
		if (!config?.apiKey) {
			throw new Error("API key not configured");
		}

		// Track API usage
		this.trackRequest();

		const url = new URL(`${API_BASE_URL}${endpoint}`);
		Object.entries(params).forEach(([key, value]) => {
			url.searchParams.append(key, value);
		});

		const response = await fetch(url.toString(), {
			headers: {
				"x-rapidapi-key": config.apiKey,
				"x-rapidapi-host": "v3.football.api-sports.io",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API request failed: ${response.status} ${errorText}`);
		}

		const data: ApiFootballResponse<T> = await response.json();

		if (data.errors.length > 0) {
			throw new Error(`API errors: ${data.errors.join(", ")}`);
		}

		return data.response;
	}

	private trackRequest(): void {
		const config = this.getConfig();
		if (!config) return;

		const today = new Date().toISOString().split("T")[0];

		if (config.requestsUsed.date !== today) {
			// Reset counter for new day
			config.requestsUsed = { date: today, count: 1 };
		} else {
			config.requestsUsed.count++;
		}

		this.saveConfig(config);
	}

	private isCacheValid(cacheEntry: { expires: Date } | null | undefined): boolean {
		return cacheEntry != null && cacheEntry.expires > new Date();
	}

	async testConnection(): Promise<{
		success: boolean;
		error?: string;
		remainingRequests?: number;
	}> {
		try {
			// Simple test request to verify API key
			await this.makeRequest("/status");

			const config = this.getConfig();
			const remainingRequests = config
				? Math.max(0, 100 - config.requestsUsed.count)
				: 100;

			return { success: true, remainingRequests };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	async getLeagues(current: boolean = true): Promise<ApiFootballLeague[]> {
		const cacheKey = `leagues_${current}`;

		if (this.isCacheValid(this.cache.leagues)) {
			return this.cache.leagues!.data;
		}

		const params = current ? { current: "true" } : {};
		const leagues = await this.makeRequest<ApiFootballLeague>(
			"/leagues",
			params,
		);

		// Cache the results
		this.cache.leagues = {
			data: leagues,
			expires: new Date(Date.now() + CACHE_DURATION),
		};

		return leagues;
	}

	async getTeams(leagueId: number, season: number): Promise<ApiFootballTeam[]> {
		const cacheKey = `${leagueId}_${season}`;

		if (this.isCacheValid(this.cache.teams[cacheKey])) {
			return this.cache.teams[cacheKey].data;
		}

		const teams = await this.makeRequest<ApiFootballTeam>("/teams", {
			league: leagueId.toString(),
			season: season.toString(),
		});

		// Cache the results
		this.cache.teams[cacheKey] = {
			data: teams,
			expires: new Date(Date.now() + CACHE_DURATION),
		};

		return teams;
	}

	async getFixtures(
		leagueId: number,
		season: number,
		status: string = "FT",
	): Promise<ApiFootballMatch[]> {
		const cacheKey = `fixtures_${leagueId}_${season}_${status}`;

		if (this.isCacheValid(this.cache.fixtures[cacheKey])) {
			return this.cache.fixtures[cacheKey].data;
		}

		const fixtures = await this.makeRequest<ApiFootballMatch>("/fixtures", {
			league: leagueId.toString(),
			season: season.toString(),
			status: status,
		});

		// Cache completed fixtures for longer
		const cacheDuration = status === "FT" ? CACHE_DURATION * 7 : CACHE_DURATION; // 7 days for completed matches

		this.cache.fixtures[cacheKey] = {
			data: fixtures,
			expires: new Date(Date.now() + cacheDuration),
		};

		return fixtures;
	}

	async getLiveFixtures(): Promise<ApiFootballMatch[]> {
		// Don't cache live data
		return await this.makeRequest<ApiFootballMatch>("/fixtures", {
			live: "all",
		});
	}

	// Configuration methods
	updateConfig(updates: Partial<ApiFootballConfig>): void {
		const config = this.getConfig() || {
			apiKey: "",
			selectedLeagues: [],
			teamMappings: {},
			lastImport: {},
			requestsUsed: { date: new Date().toISOString().split("T")[0], count: 0 },
		};

		const updatedConfig = { ...config, ...updates };
		this.saveConfig(updatedConfig);
	}

	getApiUsage(): { used: number; remaining: number; date: string } {
		const config = this.getConfig();
		if (!config) {
			const today = new Date().toISOString().split("T")[0];
			return { used: 0, remaining: 100, date: today };
		}

		const today = new Date().toISOString().split("T")[0];
		const isToday = config.requestsUsed.date === today;

		return {
			used: isToday ? config.requestsUsed.count : 0,
			remaining: isToday ? Math.max(0, 100 - config.requestsUsed.count) : 100,
			date: today,
		};
	}

	clearCache(): void {
		this.cache = {
			leagues: null,
			teams: {},
			fixtures: {},
		};
	}

	isConfigured(): boolean {
		const config = this.getConfig();
		return !!(config?.apiKey && config.apiKey.trim().length > 0);
	}
}

export const apiFootballService = new ApiFootballService();
