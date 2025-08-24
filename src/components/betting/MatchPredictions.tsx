import { useMatchAnalysis } from "../../hooks/use-match-analysis";
import { Hide } from "../hide";

interface MatchPredictionsProps {
  matchId: number;
}

export function MatchPredictions({ matchId }: MatchPredictionsProps) {
  const { data, error } = useMatchAnalysis(matchId);
  const { prediction: predictions } = data;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔮</span>
        <h4 className="font-semibold text-md">Match Predictions</h4>
      </div>

      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4">
          <Hide when={error == null}>
            <div className="text-center py-2">
              <span className="text-sm text-base-content/60">
                {error ? `Error: ${error}` : "No predictions available"}
              </span>
            </div>
          </Hide>

          <Hide when={error != null}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Winner Prediction */}
              <div className="text-center">
                <div className="text-sm text-base-content/60 mb-1">
                  Predicted Winner
                </div>
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
                <div className="text-sm text-base-content/60 mb-1">
                  Predicted Score
                </div>
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
          </Hide>
        </div>
      </div>
    </div>
  );
}
