import { ApiTokenSettings } from "../components/settings/ApiTokenSettings";

export function Settings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <div className="space-y-8">
        <ApiTokenSettings />

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">About</h2>
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body p-4">
              <h3 className="font-medium">Maestro</h3>
              <p className="text-sm text-base-content/60">
                Soccer statistics and betting tracker
              </p>
              <div className="mt-2 text-xs text-base-content/50">
                {/* todo: use git sha */}
                Version 0.1.0
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
