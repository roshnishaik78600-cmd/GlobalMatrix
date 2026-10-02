import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";

/**
 * Gates the handful of actions that genuinely require an account — watchlists,
 * annotations, saved briefs — while leaving every read surface public.
 *
 * Browsing GlobalMatrix never needs an email address. Only the writes do, so
 * this returns a wrapper that sends signed-out visitors to sign-in and returns
 * them to exactly where they were.
 */
export function useAuthAction() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const requireAuth = useCallback(
    (action?: string) => {
      if (isLoading) return false;
      if (isAuthenticated) return true;
      const returnTo = `${location.pathname}${location.search}`;
      const note = action
        ? `?returnTo=${encodeURIComponent(returnTo)}&reason=${encodeURIComponent(action)}`
        : `?returnTo=${encodeURIComponent(returnTo)}`;
      navigate(`/auth${note}`);
      return false;
    },
    [isAuthenticated, isLoading, location.pathname, location.search, navigate],
  );

  return { isAuthenticated, isLoading, requireAuth };
}

/**
 * Watchlist toggle with the auth gate already applied. Uses the same
 * `NODE:` / `SECTOR:` / bare-event key scheme the directories read back.
 */
export function useToggleWatch() {
  const mutation = useMutation(api.research.toggleWatch);
  const { requireAuth } = useAuthAction();

  return useCallback(
    async (eventId: string) => {
      if (!requireAuth("Save items to your watchlist")) return;
      await mutation({ eventId });
    },
    [requireAuth, mutation],
  );
}