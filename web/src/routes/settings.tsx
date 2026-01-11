import { useAuth } from "~/contexts/auth";

export default function Settings() {
  const auth = useAuth();
  let input!: HTMLInputElement;

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold">Settings</h1>
      </div>

      <div class="space-y-8">
        <div class="card bg-base-100 border border-base-300">
          <div class="card-body">
            <div class="flex items-center justify-between">
              <h3 class="font-medium">API Authentication</h3>
              <div
                class={`badge ${auth.isReadOnly() ? "badge-error" : "badge-success"}`}
              >
                {auth.isReadOnly() ? "Read Only" : "Full Access"}
              </div>
            </div>

            <p class="text-sm text-base-content/60 mb-4">
              {auth.isReadOnly()
                ? "Enter your API token to enable bet recording and editing."
                : "API token is configured. You can record and edit bets."}
            </p>

            <div class="join">
              <label class="input input-bordered">
                <input
                  type="text"
                  placeholder="Token"
                  class="join-item"
                  value={auth.token()}
                  ref={input}
                  onChange={(e) => auth.setToken(e.target.value)}
                />
              </label>
              <button
                type="button"
                class="btn btn-error join-item"
                onClick={() => {
                  auth.setToken("");
                  input.value = "";
                }}
                disabled={auth.isReadOnly()}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <h2 class="text-xl font-semibold">About</h2>
          <div class="card bg-base-100 border border-base-300">
            <div class="card-body p-4">
              <h3 class="font-medium">Maestro</h3>
              <p class="text-sm text-base-content/60">
                Soccer statistics and betting tracker
              </p>
              <div class="mt-2 text-xs text-base-content/50">
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
