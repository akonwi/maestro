import { render } from "preact";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Outlet } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QueryNormalizerProvider } from "@normy/react-query";

import { AuthProvider } from "./contexts/AuthContext";
import { Header } from "./components/Header";
import { Matches } from "./pages/Matches";
import { Leagues } from "./pages/Leagues";
import { BettingPerformance } from "./pages/BettingPerformance";
import { Settings } from "./pages/Settings";
import { ValueBets } from "./pages/ValueBets";
import { NotFound } from "./pages/_404";
import "./style.css";

const queryClient = new QueryClient();

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
          { index: true, Component: BettingPerformance },
          // {
          //   path: "/maestro/team/:teamId",
          //   Component: TeamDetail,
          // },
          { path: "/maestro/matches", Component: Matches },
          // { path: "/maestro/match/:matchId", Component: MatchDetail },
          { path: "/maestro/leagues", Component: Leagues },
          { path: "/maestro/betting", Component: BettingPerformance },
          { path: "/maestro/value-bets", Component: ValueBets },
          { path: "/maestro/settings", Component: Settings },
        ],
      },
    ],
  },
]);

render(
  <QueryNormalizerProvider queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </QueryNormalizerProvider>,
  document.getElementById("app")!,
);
