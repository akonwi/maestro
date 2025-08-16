import { useState } from "preact/hooks";
import { useAuth } from "../../contexts/AuthContext";

export function ApiTokenSettings() {
  const { token, isReadOnly, setToken, clearToken } = useAuth();
  const [inputToken, setInputToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const handleSaveToken = () => {
    if (inputToken.trim()) {
      setToken(inputToken);
      setInputToken("");
    }
  };

  const handleClearToken = () => {
    clearToken();
    setInputToken("");
  };

  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">API Authentication</h3>
          <div className={`badge ${isReadOnly ? "badge-error" : "badge-success"}`}>
            {isReadOnly ? "Read Only" : "Full Access"}
          </div>
        </div>
        
        <p className="text-sm text-base-content/60 mb-4">
          {isReadOnly 
            ? "Enter your API token to enable bet recording and editing."
            : "API token is configured. You can record and edit bets."
          }
        </p>

        <div className="form-control">
          <label className="label">
            <span className="label-text">API Token</span>
            {token && (
              <button
                type="button"
                className="label-text-alt btn btn-xs btn-ghost"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? "Hide" : "Show"}
              </button>
            )}
          </label>
          
          {token && showToken ? (
            <div className="input input-bordered bg-base-200 font-mono text-sm break-all">
              {token}
            </div>
          ) : (
            <input
              type="password"
              placeholder="Enter your API token..."
              className="input input-bordered"
              value={inputToken}
              onInput={(e) => setInputToken((e.target as HTMLInputElement).value)}
            />
          )}
        </div>

        <div className="card-actions justify-end mt-4">
          {token && (
            <button
              type="button"
              className="btn btn-outline btn-error"
              onClick={handleClearToken}
            >
              Clear Token
            </button>
          )}
          
          {!showToken && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveToken}
              disabled={!inputToken.trim()}
            >
              {token ? "Update Token" : "Save Token"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}