import { useBeforeLeave, useLocation } from "@solidjs/router";
import { onMount } from "solid-js";

const scrollPositions = new Map<string, number>();

export function useScrollRestoration() {
  const location = useLocation();

  // Save scroll position before leaving
  useBeforeLeave(() => {
    scrollPositions.set(location.pathname, window.scrollY);
  });

  // Restore scroll position on mount
  onMount(() => {
    const savedPosition = scrollPositions.get(location.pathname);
    if (savedPosition !== undefined) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        window.scrollTo(0, savedPosition);
      });
    }
  });
}
