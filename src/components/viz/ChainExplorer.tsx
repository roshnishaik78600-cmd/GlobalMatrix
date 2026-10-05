import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Building2, LineChart } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Panel, Skeleton } from "@/components/viz/core";
import { StatusBadge } from "@/components/viz/Provenance";
import {
  buildStages,
  type ChainRow,
  type ChainStage,
  type ChainStageId,
} from "@/lib/intel/chain";
import { riskColorForScore } from "@/lib/intel/visual";
import { cn } from "@/lib/utils";

/**
 * Follow one event all the way through the world.
 *
 * This is the signature interaction of the product, so it is the one place that
 * draws the whole chain rather than a slice of it. Nine stages, in the order a
 * shock actually travels:
 *
 *   event → country → trade → energy → infrastructure
 *         → supply chain → industry → company → market
 *
 * Every node is clickable and drives one detail panel, and the panel always
 * says which stage and which row produced what is on screen — a chain that
 * cannot be interrogated is a diagram, not an analysis.
 *
 * Two rules the layout enforces:
 *
 * 1. A stage this build cannot measure is drawn in place and labelled, never
 *    dropped. A chain missing a link reads as a finished analysis.
 * 2. INFRASTRUCTURE and SUPPLY CHAIN are separate claims. Infrastructure is
 *    where the shock travels; supply chain is how far it carries from there.
 */

export function ChainExplorer({ className }: { className?: string }) {
  const feed = useQuery(api.intel.detectionFeed, {});
  const [eventId, setEventId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<ChainStageId>("country");
  const [rowId, setRowId] = useState<string | null>(null);

  const active = eventId ?? feed?.rows[0]?.id ?? null;
  const chain = useQuery(
    api.intel.eventChain,
    active ? { eventId: active } : "skip",
  );

  // The stage list is built in a pure module so this page and the homepage's
  // Follow the Shock section cannot drift apart on what a stage means.
  const stages = useMemo<ChainStage[]>(
    () => (chain ? buildStages(chain) : []),
    [chain],
  );

  if (!feed) {
    return (
      <Panel title="Follow an event through the world" className={className}>
        <Skeleton className="m-3 h-64 w-full" />
      </Panel>
    );
  }

  const stage = stages.find((s) => s.id === stageId) ?? stages[0];
  const row = stage?.rows.find((r) => r.id === rowId) ?? stage?.rows[0] ?? null;
  const measured = stages.filter((s) => !s.unmeasured || s.rows.length > 0).length;

  return (
    <Panel
      title="Follow an event through the world"
      meta="event → country → trade → energy → infrastructure → supply chain → industry → company → market"
      className={cn("min-w-0", className)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
        <label className="label text-muted-foreground" htmlFor="chain-event">
          Event
        </label>
        <select
          id="chain-event"
          value={active ?? ""}
          onChange={(e) => {
            setEventId(e.target.value);
            // The row selection belongs to the stage, so changing event clears
            // it rather than leaving a stale highlight from the previous event.
            setRowId(null);
          }}
          className="h-8 min-w-0 flex-1 border border-rule bg-background px-2 text-[12px] outline-none focus:border-foreground"
        >
          {feed.rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.reference} — {r.title.slice(0, 56)}
            </option>
          ))}
        </select>
        {chain ? (
          <span className="flex items-center gap-2">
            <StatusBadge status="scenario" />
            <span
              className="num text-[12px] font-semibold"
              style={{ color: riskColorForScore(chain.event.score) }}
            >
              {chain.event.score.toFixed(0)}
            </span>
          </span>
        ) : null}
      </div>

      {!chain || stages.length === 0 ? (
        <Skeleton className="m-3 h-56 w-full" />
      ) : (
        <>
          {/* The chain itself. Each node is a button so the detail panel below
              always has something to be about; the connector dash runs between
              them so it reads as directed flow, not as a row of equal chips. */}
          <nav aria-label="Propagation stages" className="border-b border-rule px-3 py-3">
            <ol className="flex flex-wrap items-stretch gap-1.5">
              {stages.map((s, i) => {
                const isActive = s.id === stage?.id;
                const dim = s.unmeasured !== undefined && s.rows.length === 0;
                return (
                  <li key={s.id} className="relative min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setStageId(s.id);
                        setRowId(null);
                      }}
                      aria-pressed={isActive}
                      className={cn(
                        "flex min-w-0 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 text-left transition-colors",
                        isActive
                          ? "border-[var(--exec-cyan)] bg-[color-mix(in_srgb,var(--exec-cyan)_10%,transparent)]"
                          : "border-rule hover:border-foreground/40",
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        <span className="num text-[11px] text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={cn(
                            "label whitespace-nowrap",
                            dim && "text-muted-foreground/60",
                          )}
                        >
                          {s.title}
                        </span>
                      </span>
                      <span
                        className="block h-[3px] w-full bg-[var(--exec-surface)]"
                        aria-hidden
                      >
                        <span
                          className="block h-full transition-[width] duration-300"
                          style={{
                            width: `${Math.max(2, (s.rows[0]?.weight ?? 0) * 100)}%`,
                            backgroundColor: riskColorForScore(
                              (s.rows[0]?.weight ?? 0) * 100,
                            ),
                          }}
                        />
                      </span>
                    </button>
                    {i < stages.length - 1 ? (
                      <ArrowRight
                        className="pointer-events-none absolute top-1/2 -right-2 size-3 -translate-y-1/2 text-muted-foreground/50"
                        aria-hidden
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="grid grid-cols-1 gap-px bg-rule lg:grid-cols-12">
            {/* Rows for the selected stage. */}
            <ol className="flex flex-col bg-card lg:col-span-7">
              {stage && stage.rows.length > 0 ? (
                <>
                  <li className="border-b border-rule px-3 py-2">
                    <p className="label text-foreground/85">{stage.question}</p>
                  </li>
                  <AnimatePresence initial={false} mode="popLayout">
                    {stage.rows.map((r) => (
                      <motion.li
                        key={r.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="border-b border-rule last:border-b-0"
                      >
                        {r.href ? (
                          <Link
                            to={r.href}
                            className="block px-3 py-2 transition-colors hover:bg-[var(--exec-surface)]"
                          >
                            <RowBody
                              row={r}
                              selected={row?.id === r.id}
                              onSelect={() => {
                                setStageId(stage.id);
                                setRowId(r.id);
                              }}
                            />
                          </Link>
                        ) : (
                          <div className="px-3 py-2">
                            <RowBody
                              row={r}
                              selected={row?.id === r.id}
                              onSelect={() => {
                                setStageId(stage.id);
                                setRowId(r.id);
                              }}
                            />
                          </div>
                        )}
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </>
              ) : (
                <li className="flex flex-1 flex-col justify-center bg-card px-4 py-8">
                  {stage?.id === "company" ? (
                    <Building2 className="mb-2 size-4 text-muted-foreground" aria-hidden />
                  ) : (
                    <LineChart className="mb-2 size-4 text-muted-foreground" aria-hidden />
                  )}
                  <p className="text-[13px] font-medium">
                    {stage?.unmeasured?.title ?? `${stage?.title}: nothing measured`}
                  </p>
                  <p className="mt-1 max-w-lg text-[12px] leading-relaxed text-muted-foreground">
                    {stage?.unmeasured?.reason ??
                      "This stage has no measured rows for the selected event."}
                  </p>
                </li>
              )}
            </ol>

            {/* The detail panel. One AnimatePresence keyed on stage+row so the
                copy cross-fades instead of snapping, and so the reader always
                sees which selection produced it. */}
            <aside className="flex min-w-0 flex-col bg-card lg:col-span-5">
              <div className="border-b border-rule px-3 py-2">
                <p className="label text-muted-foreground">
                  Step {stage ? String(stages.indexOf(stage) + 1).padStart(2, "0") : "—"} ·{" "}
                  {stage?.title}
                </p>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${stage?.id}:${row?.id ?? "none"}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex min-w-0 flex-col gap-3 px-3 py-3"
                >
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {stage?.about}
                  </p>
                  {row ? (
                    <div className="flex min-w-0 flex-col gap-2">
                      <p className="min-w-0 text-[15px] font-semibold leading-snug">
                        {row.label}
                      </p>
                      {row.weight !== undefined ? (
                        <p className="flex items-baseline gap-2">
                          <span
                            className="num text-[1.75rem] leading-none font-bold"
                            style={{ color: riskColorForScore(row.weight * 100) }}
                          >
                            {(row.weight * 100).toFixed(0)}
                          </span>
                          <span className="label text-muted-foreground">
                            weighted exposure
                          </span>
                        </p>
                      ) : null}
                      {row.meta ? (
                        <p className="text-[12px] leading-relaxed text-muted-foreground">
                          {row.meta}
                        </p>
                      ) : null}
                      {row.detail ? (
                        <p className="text-[13px] leading-relaxed text-foreground/85">
                          {row.detail}
                        </p>
                      ) : null}
                      {row.href ? (
                        <Link
                          to={row.href}
                          className="label self-start text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Open {stage?.title.toLowerCase()} profile →
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </aside>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-3 py-2">
            <span className="label text-muted-foreground">
              {measured} of {stages.length} stages carry measured rows for this event · the
              rest are stated as unmeasured, never zero
            </span>
            <Link
              to={`/app/event/${chain.event.id}`}
              className="label ml-auto text-muted-foreground transition-colors hover:text-foreground"
            >
              Open the full event →
            </Link>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ parts -- */

function RowBody({
  row,
  selected,
  onSelect,
}: {
  row: ChainRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="w-full min-w-0 text-left"
    >
      <span className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            "min-w-0 truncate text-[12px]",
            selected && "text-foreground",
          )}
        >
          {row.label}
        </span>
        {row.weight !== undefined ? (
          <span
            className="num shrink-0 text-[12px]"
            style={{ color: riskColorForScore(row.weight * 100) }}
          >
            {(row.weight * 100).toFixed(0)}
          </span>
        ) : null}
      </span>
      <span className="mt-1.5 block h-[3px] w-full bg-[var(--exec-surface)]">
        <span
          className="block h-full transition-[width] duration-300"
          style={{
            width: `${Math.min(100, (row.weight ?? 0) * 100)}%`,
            backgroundColor: riskColorForScore((row.weight ?? 0) * 100),
          }}
        />
      </span>
      {row.meta ? (
        <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">
          {row.meta}
        </span>
      ) : null}
    </button>
  );
}