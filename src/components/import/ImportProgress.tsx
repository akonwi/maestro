import { ImportProgress as ImportProgressType } from "../../types/apiFootball";

interface ImportProgressProps {
  progress: ImportProgressType;
}

export function ImportProgress({ progress }: ImportProgressProps) {
  const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <h3 class="card-title">Import Progress</h3>
        
        <div class="space-y-4">
          <div>
            <div class="flex justify-between text-sm mb-1">
              <span>{progress.current}</span>
              <span>{progress.completed}/{progress.total}</span>
            </div>
            <progress 
              class="progress progress-primary w-full" 
              value={progress.completed} 
              max={progress.total}
            />
            <div class="text-center text-sm text-base-content/60 mt-1">
              {percentage.toFixed(1)}% complete
            </div>
          </div>

          {progress.errors.length > 0 && (
            <div class="space-y-2">
              <div class="text-sm font-medium text-error">
                Errors ({progress.errors.length}):
              </div>
              <div class="max-h-32 overflow-y-auto space-y-1">
                {progress.errors.map((error, index) => (
                  <div key={index} class="text-xs bg-error/10 text-error p-2 rounded">
                    {error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
