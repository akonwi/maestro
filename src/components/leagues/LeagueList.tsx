import { useLeagues } from "../../hooks/use-leagues";

export function LeagueList() {
  const { data, loading, error } = useLeagues();
  const leagues = data?.leagues || [];

  if (loading) return <div class="loading loading-spinner"></div>;

  if (error) {
    return (
      <div class="alert alert-error">
        <span>Error loading leagues: {error}</span>
      </div>
    );
  }

  if (leagues.length === 0) {
    return (
      <div class="text-center py-8 text-base-content/60">
        No leagues available
      </div>
    );
  }

  return (
    <div class="space-y-2">
      {leagues.map((league) => (
        <div key={league.id} class="card bg-base-100 shadow-sm">
          <div class="card-body py-4">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="font-semibold">{league.name}</h3>
                <p class="text-sm text-base-content/60">Code: {league.code}</p>
              </div>
              <div class="badge badge-outline">ID: {league.id}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
