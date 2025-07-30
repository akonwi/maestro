import { useState, useEffect } from "preact/hooks";

export interface ApiLeague {
  id: number;
  name: string;
  code: string;
}

export interface LeaguesResponse {
  leagues: ApiLeague[];
}

export function useLeagues() {
  const [data, setData] = useState<LeaguesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeagues = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('https://maestro-api.zeabur.app/leagues');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leagues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  return { data, loading, error, refetch: fetchLeagues };
}