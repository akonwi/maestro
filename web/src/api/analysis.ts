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

export type TeamSeasonStats = {
  overall: TeamStats;
  home_only: TeamStats;
  away_only: TeamStats;
};

export type SeasonComparisonData = {
  home: TeamSeasonStats;
  away: TeamSeasonStats;
};

export type MatchupStatsData = {
  season: SeasonComparisonData;
  form: ComparisonData | null;
};

export const matchupStatsQueryOptions = (fixtureId: number) => ({
  queryKey: ["matchup", { fixtureId }, "stats"] as const,
  queryFn: async (): Promise<MatchupStatsData> => {
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/matchup/${fixtureId}/stats`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch matchup stats: ${response.status}`);
    }

    return response.json();
  },
});

type TeamMetricsApiResponse = {
  shots: {
    total: number;
    on_target: number;
    off_target: number;
    blocked: number;
    in_box: number;
  };
  xg: number;
  corners: number;
};

export type TeamMetricsParams = {
  teamId: number;
  leagueId: number;
  season: number;
  limit?: number;
  venue?: "home" | "away";
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

export const teamMetricsQueryOptions = (
  params: TeamMetricsParams,
  headers: () => Record<string, string>,
) => ({
  queryKey: [
    "teams",
    {
      id: params.teamId,
      leagueId: params.leagueId,
      season: params.season,
      limit: params.limit,
      venue: params.venue,
    },
    "metrics",
  ] as const,
  queryFn: async (): Promise<TeamMetrics> => {
    const searchParams = new URLSearchParams({
      season: params.season.toString(),
      league_id: params.leagueId.toString(),
    });
    if (params.limit) {
      searchParams.set("limit", params.limit.toString());
    }
    if (params.venue) {
      searchParams.set("venue", params.venue);
    }

    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL}/teams/${params.teamId}/metrics?${searchParams.toString()}`,
      { headers: headers() },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch team metrics: ${response.status}`);
    }

    const body = await response.json();
    const numFixtures = body.num_fixtures || 1;

    const buildStats = (team: TeamMetricsApiResponse) => {
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
});
