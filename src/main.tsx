import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/intel/AppShell";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Detection = lazy(() => import("./pages/Detection.tsx"));
const EventAnalysis = lazy(() => import("./pages/EventAnalysis.tsx"));
const RiskBoard = lazy(() => import("./pages/RiskBoard.tsx"));
const Countries = lazy(() => import("./pages/Countries.tsx"));
const CountryProfile = lazy(() => import("./pages/CountryProfile.tsx"));
const Industries = lazy(() => import("./pages/Industries.tsx"));
const IndustryProfile = lazy(() => import("./pages/IndustryProfile.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/app" />}
              />
              <Route
                path="/app"
                element={
                  <RequireAuth
                    title="Sign in to open the console"
                    description="Detection, propagation analysis and the risk board are available to signed-in researchers."
                  >
                    <AppShell>
                      <Detection />
                    </AppShell>
                  </RequireAuth>
                }
              />
              <Route
                path="/app/risk"
                element={
                  <RequireAuth
                    title="Sign in to open the risk board"
                    description="The cross-event channel matrix is available to signed-in researchers."
                  >
                    <AppShell>
                      <RiskBoard />
                    </AppShell>
                  </RequireAuth>
                }
              />
              <Route
                path="/app/countries"
                element={
                  <RequireAuth
                    title="Sign in to open country intelligence"
                    description="Country and infrastructure profiles are available to signed-in researchers."
                  >
                    <AppShell>
                      <Countries />
                    </AppShell>
                  </RequireAuth>
                }
              />
              <Route
                path="/app/country/:nodeId"
                element={
                  <RequireAuth
                    title="Sign in to open this profile"
                    description="Country exposure and dependency structure are available to signed-in researchers."
                  >
                    <AppShell>
                      <CountryProfile />
                    </AppShell>
                  </RequireAuth>
                }
              />
              <Route
                path="/app/industries"
                element={
                  <RequireAuth
                    title="Sign in to open industry intelligence"
                    description="Sector exposure and structure are available to signed-in researchers."
                  >
                    <AppShell>
                      <Industries />
                    </AppShell>
                  </RequireAuth>
                }
              />
              <Route
                path="/app/industry/:industryId"
                element={
                  <RequireAuth
                    title="Sign in to open this sector profile"
                    description="Sector structure and live exposure are available to signed-in researchers."
                  >
                    <AppShell>
                      <IndustryProfile />
                    </AppShell>
                  </RequireAuth>
                }
              />
              <Route
                path="/app/event/:eventId"
                element={
                  <RequireAuth
                    title="Sign in to open this analysis"
                    description="Propagation mapping and evidence ledgers are available to signed-in researchers."
                  >
                    <AppShell>
                      <EventAnalysis />
                    </AppShell>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
