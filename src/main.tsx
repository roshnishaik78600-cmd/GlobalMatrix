import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { Shell } from "@/components/viz/Shell";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { FocusProvider } from "@/lib/focus";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Methodology = lazy(() => import("./pages/Methodology.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Overview = lazy(() => import("./pages/Overview.tsx"));
const Detection = lazy(() => import("./pages/Detection.tsx"));
const EventAnalysis = lazy(() => import("./pages/EventAnalysis.tsx"));
const RiskBoard = lazy(() => import("./pages/RiskBoard.tsx"));
const Countries = lazy(() => import("./pages/Countries.tsx"));
const CountryProfile = lazy(() => import("./pages/CountryProfile.tsx"));
const Industries = lazy(() => import("./pages/Industries.tsx"));
const IndustryProfile = lazy(() => import("./pages/IndustryProfile.tsx"));
const World = lazy(() => import("./pages/World.tsx"));
const Supply = lazy(() => import("./pages/Supply.tsx"));
const GraphExplorerPage = lazy(() => import("./pages/GraphExplorerPage.tsx"));
const Scenarios = lazy(() => import("./pages/Scenarios.tsx"));
const Analyst = lazy(() => import("./pages/Analyst.tsx"));
const NotAvailable = lazy(() => import("./pages/NotAvailable.tsx"));
const DataSources = lazy(() => import("./pages/DataSources.tsx"));
const Trade = lazy(() => import("./pages/Trade.tsx"));
const Chain = lazy(() => import("./pages/Chain.tsx"));
const Markets = lazy(() => import("./pages/Markets.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

/** Every console surface is publicly readable. Only the write actions
 *  (watchlists, annotations, saved briefs) require an account, and those
 *  redirect to sign-in themselves via useAuthAction. */
const console_ = (element: React.ReactNode) => <Shell>{element}</Shell>;

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
      // The raw message and stack are kept, but behind a disclosure. Showing a
      // stack trace as the page's primary content told a reader nothing they
      // could act on and leaked internals; a reader who needs the diagnostic
      // can still open it.
      return (
        <div className="min-h-screen bg-[var(--exec-base)] px-4 py-10 text-[var(--exec-ink)]">
          <div className="mx-auto max-w-lg border border-[var(--exec-hairline)]">
            <div className="flex flex-col gap-1.5 p-4">
              <div className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-[var(--exec-crimson)]" aria-hidden />
                <span className="exec-label text-[var(--exec-crimson)]">ERROR</span>
              </div>
              <p className="text-[12.5px] font-medium text-[var(--exec-ink)]">
                GlobalMatrix could not finish rendering this view
              </p>
              <p className="max-w-md text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
                The page stopped before it could draw. Your data is
                unaffected — reloading usually recovers it. If it keeps
                happening, the diagnostics below identify where.
              </p>
            </div>
            {this.state.stack ? (
              <details className="border-t border-[var(--exec-hairline)] px-4 py-2">
                <summary className="exec-label cursor-pointer select-none text-[var(--exec-ink-dim)]">
                  Diagnostics
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto break-words text-[10px] leading-4 whitespace-pre-wrap text-[var(--exec-ink-dim)]">
                  {this.state.message}
                  {"\n"}
                  {this.state.stack}
                </pre>
              </details>
            ) : null}
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
          <FocusProvider>
            <RouteSyncer />
            <Suspense fallback={<RouteLoading />}>
              <Routes>
              <Route path="/" element={<Landing />} />
              <Route
                path="/auth"
                element={<AuthPage redirectAfterAuth="/app" />}
              />
              <Route path="/app" element={console_(<Overview />)} />
              <Route path="/app/events" element={console_(<Detection />)} />
              <Route path="/app/world" element={console_(<World />)} />
              <Route path="/app/supply" element={console_(<Supply />)} />
              <Route path="/app/risk" element={console_(<RiskBoard />)} />
              <Route path="/app/graph" element={console_(<GraphExplorerPage />)} />
              <Route path="/app/scenarios" element={console_(<Scenarios />)} />
              <Route path="/app/analyst" element={console_(<Analyst />)} />
              <Route path="/app/countries" element={console_(<Countries />)} />
              <Route path="/app/country/:nodeId" element={console_(<CountryProfile />)} />
              <Route path="/app/industries" element={console_(<Industries />)} />
              <Route path="/app/industry/:industryId" element={console_(<IndustryProfile />)} />
              <Route path="/app/event/:eventId" element={console_(<EventAnalysis />)} />
              <Route path="/app/data" element={console_(<DataSources />)} />
              <Route path="/app/companies" element={console_(<NotAvailable />)} />
              <Route path="/app/chain" element={console_(<Chain />)} />
              <Route path="/app/trade" element={console_(<Trade />)} />
              <Route path="/app/markets" element={console_(<Markets />)} />
              <Route path="/app/policy" element={console_(<NotAvailable />)} />
              <Route path="/app/analogues" element={console_(<NotAvailable />)} />
              <Route path="/methodology" element={<Methodology />} />
              <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </FocusProvider>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
