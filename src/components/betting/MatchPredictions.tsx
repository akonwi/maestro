import { useMatchPredictions } from "../../hooks/use-match-predictions";

interface MatchPredictionsProps {
  matchId: number;
}

export function MatchPredictions({ matchId }: MatchPredictionsProps) {
  const { data: predictions, isLoading, error } = useMatchPredictions(matchId);

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔮</span>
          <h4 className="font-semibold text-md">Match Predictions</h4>
        </div>
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body p-4">
            <div className="flex items-center justify-center py-4">
              <div className="loading loading-spinner loading-sm mr-2"></div>
              <span className="text-sm text-base-content/60">Loading predictions...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !predictions) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔮</span>
          <h4 className="font-semibold text-md">Match Predictions</h4>
        </div>
        <div className="card bg-base-100 border border-base-300">
          <div className="card-body p-4">
            <div className="text-center py-2">
              <span className="text-sm text-base-content/60">
                {error ? `Error: ${error}` : "No predictions available"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔮</span>
        <h4 className="font-semibold text-md">Match Predictions</h4>
      </div>
      
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Winner Prediction */}
            <div className="text-center">
              <div className="text-sm text-base-content/60 mb-1">Predicted Winner</div>
              <div className="font-semibold text-primary">
                {predictions.winner.name}
              </div>
              {predictions.winner.comment && (
                <div className="text-xs text-base-content/60 mt-1">
                  {predictions.winner.comment}
                </div>
              )}
            </div>

            {/* Score Prediction */}
            <div className="text-center">
              <div className="text-sm text-base-content/60 mb-1">Predicted Score</div>
              <div className="font-semibold font-mono text-lg">
                {predictions.home_goals} - {predictions.away_goals}
              </div>
            </div>
          </div>

          {/* Advice - Full width below */}
          {predictions.advice && (
            <div className="mt-4 pt-4 border-t border-base-300">
              <div className="text-sm text-base-content/80 text-center italic">
                "{predictions.advice}"
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}