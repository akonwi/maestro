import { useState, useEffect } from "preact/hooks";
import {
  SyncConfig,
  getSyncConfig,
  setSyncConfig,
  testGitHubConnection,
} from "../../services/syncService";

interface SyncSettingsProps {
  onClose: () => void;
}

export default function SyncSettings({ onClose }: SyncSettingsProps) {
  const [config, setConfig] = useState<SyncConfig>({
    githubToken: "",
    repoOwner: "",
    repoName: "",
    filePath: "maestro.json",
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existingConfig = getSyncConfig();
    if (existingConfig) {
      setConfig(existingConfig);
    }
  }, []);

  const handleInputChange = (field: keyof SyncConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setTestResult(null);
  };

  const handleTest = async () => {
    if (!config.githubToken || !config.repoOwner || !config.repoName) {
      setError("Please fill in all required fields");
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const success = await testGitHubConnection(config);
      setTestResult(success ? "success" : "error");
      if (!success) {
        setError(
          "Connection failed. Please check your token and repository details.",
        );
      }
    } catch (err) {
      setTestResult("error");
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!config.githubToken || !config.repoOwner || !config.repoName) {
      setError("Please fill in all required fields");
      return;
    }

    if (testResult !== "success") {
      setError("Please test the connection before saving");
      return;
    }

    setSyncConfig(config);
    onClose();
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-2xl">
        <h3 className="font-bold text-lg mb-4">GitHub Sync Configuration</h3>

        <div className="space-y-4">
          <div className="alert alert-info">
            <div className="text-sm">
              <p className="font-medium">Setup Instructions:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>
                  Create a GitHub Personal Access Token with "repo" permissions
                </li>
                <li>Create a private repository to store your data</li>
                <li>Enter the details below and test the connection</li>
              </ol>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          {testResult === "success" && (
            <div className="alert alert-success">
              <span>
                ✓ Connection successful! You can now save the configuration.
              </span>
            </div>
          )}

          <div className="form-control">
            <label className="label">
              <span className="label-text">GitHub Personal Access Token *</span>
            </label>
            <input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="input input-bordered"
              value={config.githubToken}
              onInput={(e) =>
                handleInputChange(
                  "githubToken",
                  (e.target as HTMLInputElement).value,
                )
              }
            />
            <label className="label">
              <span className="label-text-alt">
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Maestro%20Sync"
                  target="_blank"
                  className="link"
                >
                  Create a new token here
                </a>
              </span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Repository Owner *</span>
              </label>
              <input
                type="text"
                placeholder="your-username"
                className="input input-bordered"
                value={config.repoOwner}
                onInput={(e) =>
                  handleInputChange(
                    "repoOwner",
                    (e.target as HTMLInputElement).value,
                  )
                }
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Repository Name *</span>
              </label>
              <input
                type="text"
                placeholder="maestro-data"
                className="input input-bordered"
                value={config.repoName}
                onInput={(e) =>
                  handleInputChange(
                    "repoName",
                    (e.target as HTMLInputElement).value,
                  )
                }
              />
            </div>
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text">File Path</span>
            </label>
            <input
              type="text"
              placeholder="maestro.json"
              className="input input-bordered"
              value={config.filePath}
              onInput={(e) =>
                handleInputChange(
                  "filePath",
                  (e.target as HTMLInputElement).value,
                )
              }
            />
            <label className="label">
              <span className="label-text-alt">
                Path where data will be stored in your repository
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-outline flex-1"
              onClick={handleTest}
              disabled={
                testing ||
                !config.githubToken ||
                !config.repoOwner ||
                !config.repoName
              }
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>
          </div>
        </div>

        <div className="modal-action">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={testResult !== "success"}
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
