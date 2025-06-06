import { render } from "preact";
import { LocationProvider, Router, Route } from "preact-iso";

import { Header } from "./components/Header";
import { Teams } from "./pages/Teams";
import { TeamDetail } from "./pages/TeamDetail";
import { Matches } from "./pages/Matches";
import { NotFound } from "./pages/_404";
import "./style.css";

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
            <Route default component={NotFound} />
          </Router>
        </main>
      </div>
    </LocationProvider>
  );
}

render(<App />, document.getElementById("app")!);
