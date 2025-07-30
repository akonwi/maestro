import { LeagueList } from "../components/leagues/LeagueList";

export function Leagues() {
  return (
    <div class="container mx-auto p-4">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-3xl font-bold">Leagues</h1>
      </div>

      <div class="card bg-base-100 shadow">
        <div class="card-body">
          <LeagueList />
        </div>
      </div>
    </div>
  );
}
