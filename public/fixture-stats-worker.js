// Service Worker for fetching fixture statistics in background

let accumulator = null;

// Initialize accumulator
const initializeAccumulator = () => ({
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
});

// Helper function to extract stat value
const getStatValue = (stats, type) => {
	const stat = stats.find((s) => s.type === type);
	if (!stat || stat.value === null) return 0;
	return typeof stat.value === "string" ? parseFloat(stat.value) : stat.value;
};

// Process a single fixture and update accumulator
const processFixture = (fixtureResponse, targetTeamId) => {
	if (!fixtureResponse || !accumulator) return;

	// Determine if target team is home or away
	const isHomeTeam = fixtureResponse.teams.home.id === targetTeamId;
	const opponentTeamId = isHomeTeam ? fixtureResponse.teams.away.id : fixtureResponse.teams.home.id;

	// Find statistics for both teams
	const targetTeamStats = fixtureResponse.statistics.find(
		(s) => s.team.id === targetTeamId,
	);
	const opponentTeamStats = fixtureResponse.statistics.find(
		(s) => s.team.id === opponentTeamId,
	);

	if (!targetTeamStats || !opponentTeamStats) return;

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
};

// Handle messages from main thread
self.addEventListener("message", async (event) => {
	const message = event.data;

	if (message.type === "INITIALIZE") {
		accumulator = initializeAccumulator();
		self.postMessage({ type: "INITIALIZED" });
		return;
	}

	if (message.type === "PROCESS_FIXTURES") {
		if (!accumulator) return;

		const { fixtureId, authToken, fixtures } = message;
		const targetTeamId = fixtureId;
		if (!targetTeamId) return;

		for (const fixtureData of fixtures) {
			try {
				// Fetch detailed fixture statistics
				const response = await fetch(
					`https://v3.football.api-sports.io/fixtures?id=${fixtureData.fixtureId}`,
					{ headers: { "X-RapidAPI-Key": authToken } },
				);
				if (!response.ok) continue; // Skip failed requests

				const data = await response.json();
				const fixtureResponse = data.response[0];
				
				processFixture(fixtureResponse, targetTeamId);
			} catch (error) {
				console.warn(`Failed to fetch stats for fixture ${fixture.fixture.id}:`, error);
				continue; // Skip failed fixtures
			}
		}

		self.postMessage({ 
			type: "COMPLETED", 
			metrics: accumulator 
		});
	}
});