import { useQuery } from "@tanstack/solid-query";
import { useAuth } from "~/contexts/auth";

export type Team = {
  id: number;
  name: string;
};

export type TeamStats = {
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
};

export type ComparisonData = {
  home: TeamStats;
  away: TeamStats;
};

export type MatchupStatsData = {
  season: ComparisonData;
  form: ComparisonData | null;
};

export function useMatchupStats(fixtureId: number) {
  return useQuery<MatchupStatsData>(() => ({
    queryKey: ["matchup", { fixtureId }, "stats"],
    queryFn: async () => {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/matchup/${fixtureId}/stats`,
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch matchup stats: ${response.status}`);
      }

      return response.json();
    },
  }));
}

export type UseTeamMetrics = {
  teamId: number;
  leagueId: number;
  season: number;
  limit?: number;
};

export type TeamMetricsCacheKey = {
  teamId: number;
  leagueId: number;
  season: number;
  limit?: number;
};

type ShotMetrics = {
  total: number;
  onGoal: number;
  missed: number;
  blocked: number;
  insideBox: number;
  outsideBox: number;
};

type StatCategory = {
  shots: ShotMetrics;
  xg: number;
  corners: number;
};

export type TeamMetrics = Record<
  "for" | "against",
  {
    total: StatCategory;
    perGame: StatCategory;
  }
> & { num_fixtures: number };

export function useTeamMetrics(getProps: () => UseTeamMetrics) {
  const auth = useAuth();

  return useQuery(() => {
    const props = getProps();
    return {
      queryKey: [
        "teams",
        { id: props.teamId, leagueId: props.leagueId, season: props.season, limit: props.limit },
        "metrics",
      ],
      queryFn: async () => {
        const params = new URLSearchParams({
          season: props.season.toString(),
          league_id: props.leagueId.toString(),
        });
        if (props.limit) {
          params.set("limit", props.limit.toString());
        }

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
      const numFixtures = body.num_fixtures || 1;

      const buildStats = (team: any) => {
        const totalShots = team.shots.total;
        const shotStats = {
          total: totalShots,
          onGoal: team.shots.on_target,
          missed: team.shots.off_target,
          blocked: team.shots.blocked,
          insideBox: team.shots.in_box,
          outsideBox: totalShots - team.shots.in_box,
        };

        return {
          total: {
            shots: shotStats,
            xg: team.xg,
            corners: team.corners,
          },
          perGame: {
            shots: {
              total: totalShots / numFixtures,
              onGoal: team.shots.on_target / numFixtures,
              missed: team.shots.off_target / numFixtures,
              blocked: team.shots.blocked / numFixtures,
              insideBox: team.shots.in_box / numFixtures,
              outsideBox: (totalShots - team.shots.in_box) / numFixtures,
            },
            xg: team.xg / numFixtures,
            corners: team.corners / numFixtures,
          },
        };
      };

      return {
        num_fixtures: numFixtures,
        for: buildStats(body.team),
        against: buildStats(body.against),
      };
    },
  };
  });
}
