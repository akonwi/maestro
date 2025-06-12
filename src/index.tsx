import { render } from "preact";
import { LocationProvider, Router, Route } from "preact-iso";

import { Header } from "./components/Header";
import { Teams } from "./pages/Teams";
import { TeamDetail } from "./pages/TeamDetail";
import { Matches } from "./pages/Matches";
import { MatchDetail } from "./pages/MatchDetail";
import { BettingPerformance } from "./pages/BettingPerformance";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/_404";
import { swManager } from "./services/serviceWorkerManager";
import "./style.css";

// Register service worker for background sync
if (swManager.isSupported()) {
  swManager.register().then(success => {
    if (success) {
      console.log('Service Worker registered for background sync');
    }
  });
}

export function App() {
  return (
    <LocationProvider>
      <div className="min-h-screen bg-base-200">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Router>
            <Route path="/" component={Teams} />
            <Route path="/team/:teamId" component={TeamDetail} />
            <Route path="/matches" component={Matches} />
            <Route path="/match/:matchId" component={MatchDetail} />
            <Route path="/betting" component={BettingPerformance} />
            <Route path="/settings" component={Settings} />
            <Route default component={NotFound} />
          </Router>
        </main>
      </div>
    </LocationProvider>
  );
}

render(<App />, document.getElementById("app")!);
