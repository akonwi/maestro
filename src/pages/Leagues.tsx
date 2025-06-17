import { LeagueForm } from "../components/leagues/LeagueForm";
import { LeagueList } from "../components/leagues/LeagueList";

export function Leagues() {
  return (
    <div class="container mx-auto p-4">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">Leagues</h1>
      </div>

      <div class="space-y-6">
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">Create New League</h2>
            <LeagueForm />
          </div>
        </div>

        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <h2 class="card-title">Manage Leagues</h2>
            <LeagueList />
          </div>
        </div>
      </div>
    </div>
  );
}
