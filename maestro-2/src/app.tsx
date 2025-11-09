import "./app.css";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { clientOnly } from "@solidjs/start";
import { Suspense } from "solid-js";
import { Header } from "./components/header";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";

const AuthProvider = clientOnly(() => import("./contexts/auth.provider"));

const queryClient = new QueryClient();

export default function App() {
  return (
    <Router
      root={(props) => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <div class="min-h-screen bg-base-200">
              <Header />
              <main class="container mx-auto px-4 py-8">
                <Suspense>{props.children}</Suspense>
              </main>
            </div>
          </AuthProvider>
        </QueryClientProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
