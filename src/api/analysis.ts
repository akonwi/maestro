import { useQuery } from "@tanstack/solid-query";
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
			outsideBox: number;
		};
		xg: number;
		corners: number;
	}
> & { num_fixtures: number };

export function useTeamMetrics(props: UseTeamMetrics) {
	const auth = useAuth();

	return useQuery(() => ({
		queryKey: [
			"teams",
			{ id: props.teamId, leagueId: props.leagueId, season: props.season },
			"metrics",
		],
		queryFn: async () => {
			const params = new URLSearchParams({
				season: props.season.toString(),
				league_id: props.leagueId.toString(),
			});

			const response = await fetch(
				`${import.meta.env.VITE_API_BASE_URL}/teams/${
					props.teamId
				}/metrics?${params.toString()}`,
				{
					headers: auth.headers(),
				},
			);

			if (!response.ok) {
				throw new Error(`Failed to fetch team metrics: ${response.status}`);
			}

			const body = await response.json();
			return {
				num_fixtures: body.num_fixtures,
				for: {
					shots: {
						total: body.team.shots.total,
						onGoal: body.team.shots.on_target,
						missed: body.team.shots.off_target,
						blocked: body.team.shots.blocked,
						insideBox: body.team.shots.in_box,
						outsideBox: body.team.shots.total - body.team.shots.in_box,
					},
					xg: body.team.xg,
					corners: body.team.corners,
				},
				against: {
					shots: {
						total: body.against.shots.total,
						onGoal: body.against.shots.on_target,
						missed: body.against.shots.off_target,
						blocked: body.against.shots.blocked,
						insideBox: body.against.shots.in_box,
						outsideBox: body.against.shots.total - body.against.shots.in_box,
					},
					xg: body.against.xg,
					corners: body.against.corners,
				},
			};
		},
	}));
}
