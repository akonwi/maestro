import "./app.css";
import { Toast } from "@kobalte/core/toast";
import { Router } from "@solidjs/router";
import { clientOnly } from "@solidjs/start";
import { FileRoutes } from "@solidjs/start/router";
import { QueryClient, QueryClientProvider } from "@tanstack/solid-query";
import { Suspense } from "solid-js";
import { Portal } from "solid-js/web";
import { Header } from "~/components/header";
import { BetFormProvider } from "./components/bet-form.provider";
import { PageSkeleton } from "./components/page-skeleton";

const AuthProvider = clientOnly(() => import("~/contexts/auth.provider"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <Router
      base={import.meta.env.SERVER_BASE_URL}
      root={props => (
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BetFormProvider>
              <div class="min-h-screen bg-base-200">
                <Header />
                <main class="container mx-auto px-4 py-8">
                  <Suspense fallback={<PageSkeleton />}>
                    {props.children}
                  </Suspense>
                </main>
              </div>
            </BetFormProvider>
            <Portal>
              <Toast.Region>
                <Toast.List class="toast" />
              </Toast.Region>
            </Portal>
          </AuthProvider>
        </QueryClientProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
