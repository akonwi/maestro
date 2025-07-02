import { useState } from "preact/hooks";
import { useQuickImport } from "../../hooks/useQuickImport";
import { Link } from "react-router";

interface QuickImportProps {
  onImportComplete?: () => void;
}

export function QuickImport({ onImportComplete }: QuickImportProps) {
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    imported?: number;
    skipped?: number;
    errors?: string[];
  } | null>(null);

  const { isImporting, progress, canQuickImport, quickImport } = useQuickImport();

  const { canImport, reason } = canQuickImport();

  const handleQuickImport = async () => {
    setShowResult(false);
    const importResult = await quickImport();
    setResult(importResult);
    setShowResult(true);

    if (importResult.success && onImportComplete) {
      onImportComplete();
    }
  };

  const handleCloseResult = () => {
    setShowResult(false);
    setResult(null);
  };

  if (!canImport) {
    return (
      <div className="alert alert-info">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="font-bold">Quick Import Not Available</h3>
          <div className="text-sm">
            {reason} - <Link to="/settings" className="link">Configure in Settings</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <button
          className="btn btn-primary"
          onClick={handleQuickImport}
          disabled={isImporting}
        >
          {isImporting ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Importing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Import All Configured Leagues
            </>
          )}
        </button>
      </div>

      {progress && (
        <div className="alert alert-info">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <div className="text-sm font-medium">{progress.current}</div>
            {progress.total > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <progress 
                  className="progress progress-primary w-full" 
                  value={progress.completed} 
                  max={progress.total}
                ></progress>
                <span className="text-xs text-base-content/60">
                  {progress.completed}/{progress.total}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {showResult && result && (
        <div className={`alert ${result.success ? 'alert-success' : 'alert-error'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d={result.success 
                ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                : "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              } 
            />
          </svg>
          <div className="flex-1">
            <div className="font-medium">{result.message}</div>
            {result.errors && result.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm">
                  {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                </summary>
                <ul className="list-disc list-inside text-xs mt-1 ml-4">
                  {result.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <button 
            className="btn btn-sm btn-ghost" 
            onClick={handleCloseResult}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}