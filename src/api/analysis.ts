import { useQuery } from "@tanstack/solid-query";
import { useFixtures } from "./fixtures";
import { Accessor } from "solid-js";
import { useAuth } from "~/contexts/auth";

export type AnalysisData = {
	comparison: ComparisonData;
};

export type TeamStats = {
	id: number;
	name: string;
	num_games: number;
	wins: number;
	draws: number;
	losses: number;
	goals_for: number;
	one_plus_scored: number;
	strike_rate: number;
	goals_against: number;
	goals_diff: number;
	xgf: number;
	xga: number;
	cleansheets: number;
	one_conceded: number;
	two_plus_conceded: number;
	win_rate: number;
	position: number;
};

export type ComparisonData = {
	home: TeamStats;
	away: TeamStats;
};

export function useMatchup(matchId: number) {
	return useQuery<AnalysisData>(() => ({
		queryKey: ["analysis", { matchId }],
		queryFn: async () => {
			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/analysis/${matchId}`,
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch analysis: ${response.status}`);
			}

			return response.json();
		},
	}));
}

export type UseTeamMetrics = {
	teamId: number;
	leagueId: number;
	season: number;
};

export type TeamMetricsCacheKey = {
	teamId: number;
	leagueId: number;
	season: number;
};

export type TeamMetrics = Record<
	"for" | "against",
	{
		shots: {
			total: number;
			onGoal: number;
			missed: number;
			blocked: number;
			insideBox: number;
		};
		xg: number;
		corners: number;
	}
>;

// Cache management functions
const getCacheKey = (teamId: number, leagueId: number, season: number): string => {
	return `team-metrics-${teamId}-${leagueId}-${season}`;
};

const getCachedMetrics = (cacheKey: string): TeamMetrics | null => {
	try {
		const cached = localStorage.getItem(cacheKey);
		if (!cached) return null;
		
		const { data, timestamp } = JSON.parse(cached);
		const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
		
		// Return cached data if less than 12 hours old
		if (ageHours < 12) {
			return data;
		}
		
		// Remove expired cache
		localStorage.removeItem(cacheKey);
		return null;
	} catch {
		return null; // If cache is corrupted, ignore it
	}
};

const setCachedMetrics = (cacheKey: string, metrics: TeamMetrics): void => {
	try {
		const cacheData = {
			data: metrics,
			timestamp: Date.now(),
		};
		localStorage.setItem(cacheKey, JSON.stringify(cacheData));
	} catch {
		// Ignore cache errors
	}
};

// Helper function to extract stat value (copied from worker)
const getStatValue = (stats: any[], type: string): number => {
	const stat = stats.find((s) => s.type === type);
	if (!stat || stat.value === null) return 0;
	return typeof stat.value === "string" ? parseFloat(stat.value) : stat.value;
};

// Main thread processing function (fallback)
const processFixturesOnMainThread = async (
	teamId: number,
	authToken: string,
	fixtures: any[],
	cacheKey: string
): Promise<TeamMetrics> => {
	const accumulator = {
		for: {
			shots: { total: 0, onGoal: 0, missed: 0, blocked: 0, insideBox: 0 },
			xg: 0,
			corners: 0,
		},
		against: {
			shots: { total: 0, onGoal: 0, missed: 0, blocked: 0, insideBox: 0 },
			xg: 0,
			corners: 0,
		},
	};

	for (const fixture of fixtures) {
		try {
			// Fetch detailed fixture statistics
			const response = await fetch(
				`https://v3.football.api-sports.io/fixtures?id=${fixture.fixture.id}`,
				{ headers: { "X-RapidAPI-Key": authToken } },
			);
			if (!response.ok) continue; // Skip failed requests

			const data = await response.json();
			const fixtureResponse = data.response[0];
			
			if (!fixtureResponse) continue;

			// Determine if target team is home or away
			const isHomeTeam = fixtureResponse.teams.home.id === teamId;
			const opponentTeamId = isHomeTeam ? fixtureResponse.teams.away.id : fixtureResponse.teams.home.id;

			// Find statistics for both teams
			const targetTeamStats = fixtureResponse.statistics.find(
				(s) => s.team.id === teamId,
			);
			const opponentTeamStats = fixtureResponse.statistics.find(
				(s) => s.team.id === opponentTeamId,
			);

			if (!targetTeamStats || !opponentTeamStats) continue;

			const targetStats = targetTeamStats.statistics;
			const opponentStats = opponentTeamStats.statistics;

			// Extract and accumulate metrics
			const shotsTotal = getStatValue(targetStats, "Total Shots");
			const shotsOnGoal = getStatValue(targetStats, "Shots on Goal");
			const shotsOffGoal = getStatValue(targetStats, "Shots off Goal");
			const shotsBlocked = getStatValue(targetStats, "Blocked Shots");
			const shotsInsideBox = getStatValue(targetStats, "Shots insidebox");
			const xg = getStatValue(targetStats, "expected_goals");
			const corners = getStatValue(targetStats, "Corner Kicks");

			// Extract opponent metrics for "against" stats
			const oppShotsTotal = getStatValue(opponentStats, "Total Shots");
			const oppShotsOnGoal = getStatValue(opponentStats, "Shots on Goal");
			const oppShotsOffGoal = getStatValue(opponentStats, "Shots off Goal");
			const oppShotsBlocked = getStatValue(opponentStats, "Blocked Shots");
			const oppShotsInsideBox = getStatValue(opponentStats, "Shots insidebox");
			const oppXg = getStatValue(opponentStats, "expected_goals");
			const oppCorners = getStatValue(opponentStats, "Corner Kicks");

			// Accumulate "for" metrics (target team's performance)
			accumulator.for.shots.total += shotsTotal;
			accumulator.for.shots.onGoal += shotsOnGoal;
			accumulator.for.shots.missed += shotsOffGoal;
			accumulator.for.shots.blocked += shotsBlocked;
			accumulator.for.shots.insideBox += shotsInsideBox;
			accumulator.for.xg += xg;
			accumulator.for.corners += corners;

			// Accumulate "against" metrics (opponent's performance)
			accumulator.against.shots.total += oppShotsTotal;
			accumulator.against.shots.onGoal += oppShotsOnGoal;
			accumulator.against.shots.missed += oppShotsOffGoal;
			accumulator.against.shots.blocked += oppShotsBlocked;
			accumulator.against.shots.insideBox += oppShotsInsideBox;
			accumulator.against.xg += oppXg;
			accumulator.against.corners += oppCorners;
		} catch (error) {
			console.warn(`Failed to fetch stats for fixture ${fixture.fixture.id}:`, error);
			continue; // Skip failed fixtures
		}
	}

	// Cache the computed metrics
	setCachedMetrics(cacheKey, accumulator);

	return accumulator;
};

export function useTeamMetrics(props: Accessor<UseTeamMetrics>) {
	const fixturesQuery = useFixtures(props);
	const auth = useAuth();

	return useQuery(() => ({
		queryKey: ["team-metrics", props()],
		enabled: fixturesQuery.data !== undefined,
		queryFn: async function (): Promise<TeamMetrics> {
			if (fixturesQuery.isError) throw fixturesQuery.error;
			if (!fixturesQuery.data) {
				// Return zeros if no data
				return {
					for: {
						shots: { total: 0, onGoal: 0, missed: 0, blocked: 0, insideBox: 0 },
						xg: 0,
						corners: 0,
					},
					against: {
						shots: { total: 0, onGoal: 0, missed: 0, blocked: 0, insideBox: 0 },
						xg: 0,
						corners: 0,
					},
				};
			}

			const { teamId, leagueId, season } = props();
			const cacheKey = getCacheKey(teamId, leagueId, season);

			// Check cache first
			const cachedMetrics = getCachedMetrics(cacheKey);
			if (cachedMetrics) {
				return cachedMetrics;
			}

			// Check if Worker is supported
			const isWorkerSupported = typeof Worker !== 'undefined';

			if (isWorkerSupported) {
				try {
					// Create and initialize service worker
					const worker = new Worker("/fixture-stats-worker.js");
					
					// Initialize worker
					worker.postMessage({ type: "INITIALIZE" });
					
					// Wait for worker to be initialized
					await new Promise<void>((resolve) => {
						const initHandler = (e: MessageEvent) => {
							if (e.data.type === "INITIALIZED") {
								worker.removeEventListener("message", initHandler);
								resolve();
							}
						};
						worker.addEventListener("message", initHandler);
					});

					// Send fixtures to worker for processing
					const fixturesData = fixturesQuery.data.response.map(f => ({
						fixtureId: f.fixture.id,
						homeTeamId: f.teams.home.id,
						awayTeamId: f.teams.away.id,
					}));
					
					worker.postMessage({
						type: "PROCESS_FIXTURES",
						fixtureId: teamId,
						authToken: auth.token(),
						fixtures: fixturesData,
					});

					// Wait for worker to complete processing
					return new Promise<TeamMetrics>((resolve, reject) => {
						const completeHandler = (e: MessageEvent) => {
							if (e.data.type === "COMPLETED") {
								worker.removeEventListener("message", completeHandler);
								worker.terminate();
								
								const metrics = e.data.metrics;
								
								// Cache the computed metrics
								setCachedMetrics(cacheKey, metrics);
								
								resolve(metrics);
							}
						};
						worker.addEventListener("message", completeHandler);

						// Timeout after 30 seconds
						setTimeout(() => {
							worker.removeEventListener("message", completeHandler);
							worker.terminate();
							reject(new Error("Service worker timeout"));
						}, 30000);
					});
				} catch (error) {
					// If worker fails, fall back to main thread
					console.warn("Worker failed, falling back to main thread:", error);
				}
			}

			// Fallback: Process on main thread
			return processFixturesOnMainThread(teamId, auth.token(), fixturesQuery.data.response, cacheKey);
		},
	}));
}
