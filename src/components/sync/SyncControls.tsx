import { useState, useEffect } from "preact/hooks";
import {
  getSyncConfig,
  getSyncStatus,
  syncToGitHub,
  syncFromGitHub,
  exportToFile,
  importFromFile,
} from "../../services/syncService";
import {
  swManager,
  getAutoSyncSettings,
} from "../../services/serviceWorkerManager";
import SyncSettings from "./SyncSettings";

export default function SyncControls() {
  const [showSettings, setShowSettings] = useState(false);
  const [syncStatus, setSyncStatus] = useState(getSyncStatus());
  const [isConfigured, setIsConfigured] = useState(!!getSyncConfig());
  const [autoSyncSettings, setAutoSyncSettingsState] = useState(
    getAutoSyncSettings(),
  );

  // Update status every second when sync is in progress
  useEffect(() => {
    if (syncStatus.syncInProgress) {
      const interval = setInterval(() => {
        setSyncStatus(getSyncStatus());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [syncStatus.syncInProgress]);

  // Refresh status when component mounts or settings close
  useEffect(() => {
    setSyncStatus(getSyncStatus());
    setIsConfigured(!!getSyncConfig());
    setAutoSyncSettingsState(getAutoSyncSettings());
  }, [showSettings]);

  const handleSyncUp = async () => {
    try {
      await syncToGitHub();
      setSyncStatus(getSyncStatus());
    } catch (error) {
      console.error("Sync up failed:", error);
      alert(error instanceof Error ? error.message : "Sync failed");
    }
  };

  const handleSyncDown = async () => {
    if (
      confirm(
        "This will replace all local data with data from GitHub. Are you sure?",
      )
    ) {
      try {
        await syncFromGitHub();
        setSyncStatus(getSyncStatus());
      } catch (error) {
        console.error("Sync down failed:", error);
        alert(error instanceof Error ? error.message : "Sync failed");
      }
    }
  };

  const handleExport = async () => {
    try {
      await exportToFile();
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed");
    }
  };

  const handleImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (
      confirm(
        "This will replace all local data with data from the file. Are you sure?",
      )
    ) {
      try {
        await importFromFile(file);
        alert("Data imported successfully");
      } catch (error) {
        console.error("Import failed:", error);
        alert(error instanceof Error ? error.message : "Import failed");
      }
    }

    // Reset the input
    input.value = "";
  };

  const handleAutoSyncToggle = async () => {
    if (autoSyncSettings.enabled) {
      await swManager.stopAutoSync();
    } else {
      const success = await swManager.startAutoSync();
      if (!success) {
        alert(
          "Failed to start auto-sync. Make sure sync is configured properly.",
        );
        return;
      }
    }
    setAutoSyncSettingsState(getAutoSyncSettings());
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return "Never";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Data Sync</h2>
        <button
          className="btn btn-sm btn-outline"
          onClick={() => setShowSettings(true)}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Sync Status */}
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">Sync Status</h3>
              <div className="text-sm text-base-content/60 space-y-1">
                <div>Last sync: {formatLastSync(syncStatus.lastSync)}</div>
                {syncStatus.syncInProgress && (
                  <div className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-xs"></span>
                    Syncing...
                  </div>
                )}
                {syncStatus.lastError && (
                  <div className="text-error">
                    Error: {syncStatus.lastError}
                  </div>
                )}
              </div>
            </div>
            <div
              className={`badge ${isConfigured ? "badge-success" : "badge-warning"}`}
            >
              {isConfigured ? "Configured" : "Not Configured"}
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Sync Controls */}
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">GitHub Sync</h3>
            {isConfigured && swManager.isSupported() && (
              <div className="form-control">
                <label className="label cursor-pointer gap-2">
                  <span className="label-text text-sm">Auto-sync</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-sm"
                    checked={autoSyncSettings.enabled}
                    onChange={handleAutoSyncToggle}
                  />
                </label>
              </div>
            )}
          </div>

          {!isConfigured ? (
            <div className="text-center py-4">
              <p className="text-base-content/60 mb-3">
                Configure GitHub sync to sync across devices
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setShowSettings(true)}
              >
                Set Up GitHub Sync
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                className="btn btn-outline btn-sm"
                onClick={handleSyncUp}
                disabled={syncStatus.syncInProgress}
              >
                ↑ Upload to GitHub
              </button>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleSyncDown}
                disabled={syncStatus.syncInProgress}
              >
                ↓ Download from GitHub
              </button>
            </div>
          )}

          {isConfigured && autoSyncSettings.enabled && (
            <div className="mt-3 p-2 bg-base-200 rounded text-sm">
              <div className="flex justify-between items-center">
                <span>Auto-sync every hour</span>
                <span className="text-base-content/60">
                  {autoSyncSettings.lastAutoSync
                    ? `Last: ${formatLastSync(autoSyncSettings.lastAutoSync)}`
                    : "Never"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Export/Import */}
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body p-4">
          <h3 className="font-medium mb-3">Manual Backup</h3>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn btn-outline btn-sm" onClick={handleExport}>
              📁 Export to File
            </button>
            <label className="btn btn-outline btn-sm cursor-pointer">
              📂 Import from File
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </div>
        </div>
      </div>

      {showSettings && <SyncSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
