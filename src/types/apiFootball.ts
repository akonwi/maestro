// API-Football response types
export interface ApiFootballLeague {
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
  };
  country: {
    name: string;
    code: string;
    flag: string;
  };
  seasons: Array<{
    year: number;
    start: string;
    end: string;
    current: boolean;
  }>;
}

export interface ApiFootballTeam {
  team: {
    id: number;
    name: string;
    code: string;
    country: string;
    founded: number;
    national: boolean;
    logo: string;
  };
  venue: {
    id: number;
    name: string;
    address: string;
    city: string;
    capacity: number;
    surface: string;
    image: string;
  };
}

export interface ApiFootballMatch {
  fixture: {
    id: number;
    referee: string;
    timezone: string;
    date: string;
    timestamp: number;
    status: {
      long: string;
      short: string;
      elapsed: number;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    round: string;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
    away: {
      id: number;
      name: string;
      logo: string;
      winner: boolean | null;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: {
      home: number | null;
      away: number | null;
    };
    fulltime: {
      home: number | null;
      away: number | null;
    };
    extratime: {
      home: number | null;
      away: number | null;
    };
    penalty: {
      home: number | null;
      away: number | null;
    };
  };
}

// Configuration interfaces
export interface ApiFootballConfig {
  apiKey: string;
  selectedLeagues: number[];
  teamMappings: { [apiTeamId: number]: string }; // API ID -> Local Team ID
  lastImport: { [leagueId: number]: Date };
  requestsUsed: { date: string; count: number };
}

export interface TeamMapping {
  apiTeamId: number;
  apiTeamName: string;
  apiTeamLogo: string;
  localTeamId: string | null; // null = create new team
  localTeamName: string;
  leagueId: string; // Local league ID
}

export interface ImportProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

// Cached data structure
export interface CachedApiData {
  leagues: { data: ApiFootballLeague[]; expires: Date } | null;
  teams: { [leagueId: number]: { data: ApiFootballTeam[]; expires: Date } };
  fixtures: { [key: string]: { data: ApiFootballMatch[]; expires: Date } };
}

// API Response wrapper
export interface ApiFootballResponse<T> {
  get: string;
  parameters: { [key: string]: string };
  errors: string[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}
