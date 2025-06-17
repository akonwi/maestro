import { useState, useEffect } from "preact/hooks";
import { apiFootballService } from "../../services/apiFootballService";
import { ApiFootballLeague } from "../../types/apiFootball";

interface LeagueSelectorProps {
  selectedLeagues: number[];
  onSelectionChange: (leagueIds: number[]) => void;
  disabled?: boolean;
}

export function LeagueSelector({ selectedLeagues, onSelectionChange, disabled }: LeagueSelectorProps) {
  const [leagues, setLeagues] = useState<ApiFootballLeague[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadLeagues();
  }, []);

  const loadLeagues = async () => {
    if (!apiFootballService.isConfigured()) {
      setError("API key not configured");
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const leagueData = await apiFootballService.getLeagues(true);
      setLeagues(leagueData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leagues");
      console.error("Failed to load leagues:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLeagueToggle = (leagueId: number) => {
    if (disabled) return;
    
    const isSelected = selectedLeagues.includes(leagueId);
    if (isSelected) {
      onSelectionChange(selectedLeagues.filter(id => id !== leagueId));
    } else {
      onSelectionChange([...selectedLeagues, leagueId]);
    }
  };

  const filteredLeagues = leagues.filter(league =>
    league.league.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    league.country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group leagues by country for better organization
  const leaguesByCountry = filteredLeagues.reduce((acc, league) => {
    const country = league.country.name;
    if (!acc[country]) acc[country] = [];
    acc[country].push(league);
    return acc;
  }, {} as { [country: string]: ApiFootballLeague[] });

  if (!apiFootballService.isConfigured()) {
    return (
      <div class="alert alert-warning">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>Please configure your API Football key first</span>
      </div>
    );
  }

  return (
    <div class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-semibold">Select Leagues</h3>
        <button 
          class="btn btn-sm btn-outline"
          onClick={loadLeagues}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div class="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      <input
        type="text"
        placeholder="Search leagues..."
        class="input input-bordered w-full"
        value={searchTerm}
        onInput={(e) => setSearchTerm((e.target as HTMLInputElement).value)}
        disabled={loading || disabled}
      />

      {loading ? (
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div class="max-h-96 overflow-y-auto space-y-4">
          {Object.entries(leaguesByCountry).map(([country, countryLeagues]) => (
            <div key={country} class="border border-base-300 rounded-lg p-4">
              <div class="flex items-center gap-2 mb-3">
                <img 
                  src={countryLeagues[0].country.flag} 
                  alt={country}
                  class="w-6 h-4 object-cover rounded"
                />
                <h4 class="font-medium">{country}</h4>
              </div>
              
              <div class="space-y-2">
                {countryLeagues.map((league) => (
                  <label key={league.league.id} class="flex items-center gap-3 cursor-pointer hover:bg-base-200 p-2 rounded">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-primary"
                      checked={selectedLeagues.includes(league.league.id)}
                      onChange={() => handleLeagueToggle(league.league.id)}
                      disabled={disabled}
                    />
                    <img 
                      src={league.league.logo} 
                      alt={league.league.name}
                      class="w-8 h-8 object-contain"
                    />
                    <div class="flex-1">
                      <div class="font-medium">{league.league.name}</div>
                      <div class="text-sm text-base-content/60">Season: {league.league.season}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedLeagues.length > 0 && (
        <div class="bg-base-200 p-3 rounded-lg">
          <div class="text-sm font-medium mb-2">Selected Leagues ({selectedLeagues.length})</div>
          <div class="text-sm text-base-content/70">
            {selectedLeagues.map(id => {
              const league = leagues.find(l => l.league.id === id);
              return league ? league.league.name : `League ${id}`;
            }).join(", ")}
          </div>
        </div>
      )}
    </div>
  );
}
