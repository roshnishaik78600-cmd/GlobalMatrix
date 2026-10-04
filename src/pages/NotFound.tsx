import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, Compass, LayoutGrid } from "lucide-react";

/**
 * 404.
 *
 * Same chrome, same container and same type scale as every other surface, with
 * two exits rather than a dead end: the two places a reader who followed a
 * broken link almost certainly meant to go.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--exec-base)] text-[var(--exec-ink)]">
      <header className="border-b border-[var(--exec-hairline)]">
        <div className="gm-width flex h-16 items-center px-4 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-sm bg-[var(--exec-cyan)]" aria-hidden />
            <span className="truncate text-[14px] font-semibold tracking-[0.2em] uppercase">
              Globalmatrix
            </span>
          </Link>
        </div>
      </header>

      <main className="gm-width flex flex-1 items-center px-4 py-16 lg:px-8 lg:py-24">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="exec-num text-[12px] font-semibold tracking-[0.2em] text-[var(--exec-cyan)]">
              404
            </span>
            <span className="h-px w-10 bg-[var(--exec-hairline)]" />
            <span className="exec-label">No such page</span>
          </div>

          <h1 className="t-page mt-6">This page is not in the corpus.</h1>
          <p className="t-body mt-4 max-w-lg text-[var(--exec-ink-dim)]">
            The address you followed does not resolve to a country, an event, an
            industry or a board. It may have been renamed, or the link may be
            from an older version of the site.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/app"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--exec-ink)] px-5 py-3.5 text-[14px] font-semibold text-[var(--exec-base)] transition-opacity hover:opacity-90"
            >
              <LayoutGrid className="size-4" aria-hidden />
              Open the overview
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--exec-hairline-strong)] px-5 py-3.5 text-[14px] font-semibold text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
            >
              <Compass className="size-4" aria-hidden />
              Back to the homepage
            </Link>
          </div>
        </motion.div>
      </main>
    </div>
  );
}