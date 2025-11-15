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
		},
	}));
}
