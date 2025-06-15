import { render } from "preact";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Outlet } from "react-router";

import { Header } from "./components/Header";
import { Teams } from "./pages/Teams";
import { TeamDetail } from "./pages/TeamDetail";
import { Matches } from "./pages/Matches";
import { MatchDetail } from "./pages/MatchDetail";
import { BettingPerformance } from "./pages/BettingPerformance";
import { Settings } from "./pages/Settings";
import { NotFound } from "./pages/_404";
import "./style.css";

const router = createBrowserRouter([
  {
    path: "/maestro",
    children: [
      {
        ErrorBoundary: NotFound,
        Component: function Layout() {
          return (
            <div class="min-h-screen bg-base-200">
              <Header />
              <main class="container mx-auto px-4 py-8">
                <Outlet />
              </main>
            </div>
          );
        },
        children: [
          { index: true, Component: Teams },
          {
            path: "/maestro/team/:teamId",
            Component: TeamDetail,
          },
          { path: "/maestro/matches", Component: Matches },
          { path: "/maestro/match/:matchId", Component: MatchDetail },
          { path: "/maestro/betting", Component: BettingPerformance },
          { path: "/maestro/settings", Component: Settings },
        ],
      },
    ],
  },
]);

render(<RouterProvider router={router} />, document.getElementById("app")!);
