import { formatMatchDate } from "../utils/helpers";
import { useJuice } from "../hooks/use-juice";
import { Hide } from "../components/hide";

export function ValueBets() {
  const { data: valueBets, isLoading, error } = useJuice();

  const formatOdds = (odd: number) => {
    if (odd > 0) {
      return `+${odd}`;
    }
    return odd.toString();
  };

  const formatMatchup = (fixture: any) => {
    return `${fixture.home.name} vs ${fixture.away.name}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Value Bets</h1>
      </div>

      {error && (
        <div className="alert alert-error">
          <span>Failed to load value bets: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </div>
      )}

      <Hide when={!isLoading}>
        <div className="text-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
          <div className="mt-4 text-base-content/60">Loading value bets...</div>
        </div>
      </Hide>

      <Hide when={isLoading}>
        {!valueBets || valueBets.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-base-content/60 text-lg">
              No value bets available right now
            </div>
            <div className="text-base-content/40 text-sm mt-2">
              Check back later for new opportunities
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {valueBets.map((bet, index) => (
              <div
                key={`${bet.fixture.id}-${index}`}
                className="card bg-base-100 border border-base-300 hover:shadow-md transition-shadow"
              >
                <div className="card-body">
                  <div className="flex flex-col gap-4">
                    {/* Match Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {formatMatchup(bet.fixture)}
                        </h3>
                        <p className="text-base-content/60 text-sm">
                          {bet.fixture.league_name} • {formatMatchDate(bet.fixture.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <img 
                          src={bet.fixture.home.logo} 
                          alt={bet.fixture.home.name}
                          className="w-6 h-6"
                        />
                        <span className="text-sm">vs</span>
                        <img 
                          src={bet.fixture.away.logo} 
                          alt={bet.fixture.away.name}
                          className="w-6 h-6"
                        />
                      </div>
                    </div>

                    {/* Betting Markets */}
                    <div className="space-y-3">
                      {bet.stats.map((market) => (
                        <div key={market.id} className="bg-base-200 p-3 rounded-lg">
                          <h4 className="font-medium text-sm mb-2">{market.name}</h4>
                          <div className="flex flex-wrap gap-2">
                            {market.values.map((value, valueIndex) => (
                              <div
                                key={`${market.id}-${valueIndex}`}
                                className="badge badge-lg badge-primary"
                              >
                                {value.name}: {formatOdds(value.odd)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Hide>
    </div>
  );
}