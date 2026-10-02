import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="block size-2.5 bg-signal" aria-hidden="true" />
            <span className="text-[13px] font-semibold tracking-[0.16em] uppercase">
              Meridian
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-5 py-20 lg:px-8 lg:py-32">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-12 gap-x-4"
        >
          <div className="col-span-12 lg:col-span-7">
            <div className="flex items-center gap-3">
              <span className="num text-[11px] font-semibold tracking-[0.2em] text-signal">
                404
              </span>
              <span className="h-px w-10 bg-rule" />
              <span className="label text-muted-foreground">No such event</span>
            </div>
            <h1 className="display mt-8 text-[2.6rem] sm:text-[3.6rem]">
              This page is not
              <br />
              in the corpus.
            </h1>
            <p className="mt-6 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
              The address you followed does not resolve to a detection feed, a
              risk board or an assessed event.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/app"
                className="group flex items-center justify-between gap-6 border border-foreground bg-foreground px-5 py-4 text-background transition-opacity hover:opacity-88"
              >
                <span className="label">Detection feed</span>
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/"
                className="label flex items-center justify-between gap-6 border border-foreground px-5 py-4 transition-colors hover:bg-foreground hover:text-background"
              >
                <span className="label">Back to start</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}