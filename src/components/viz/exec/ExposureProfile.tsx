import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowUpRight, LogIn, Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuthAction } from "@/hooks/use-auth-action";
import { ExecCard, SectionTitle } from "@/components/viz/exec/system";
import { Bar } from "@/components/viz/core";
import { pct } from "@/lib/format";
import { CHANNEL_LABEL } from "@/lib/intel/types";
import { MAX_DEPENDENCIES } from "@/lib/intel/profile";

/**
 * The reader's declared exposure profile.
 *
 * The one question the corpus cannot answer on its own is "does this reach
 * *me*" — which countries, chokepoints and sectors a particular reader actually
 * depends on. This panel lets them declare those dependencies and reports which
 * events in the corpus reach them, resolved by the same model walk every other
 * page uses.
 *
 * Everything the reader did not declare is absent rather than assumed. The
 * panel never infers a supply chain from adjacency and never shows a row it
 * cannot trace to a real event, which is why an empty match reads as a finding
 * ("nothing in the corpus reaches this") rather than a blank.
 */

interface Option {
  value: string;
  label: string;
  group: string;
}

export function ExposureProfile() {
  const profile = useQuery(api.exposureProfile.listProfile, {});
  const directory = useQuery(api.intel.countryDirectory);
  const industries = useQuery(api.intel.industryDirectory);
  const add = useMutation(api.exposureProfile.addDependency);
  const remove = useMutation(api.exposureProfile.removeDependency);
  const { isAuthenticated, requireAuth } = useAuthAction();

  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo<Option[]>(() => {
    const list: Option[] = [];
    for (const c of directory?.countries ?? []) {
      list.push({ value: `node:${c.nodeId}`, label: c.label, group: "Countries & regions" });
    }
    for (const c of directory?.corridors ?? []) {
      if (c.kind === "institution") continue;
      list.push({ value: `node:${c.nodeId}`, label: c.label, group: "Chokepoints & corridors" });
    }
    for (const i of industries?.industries ?? []) {
      list.push({ value: `industry:${i.id}`, label: i.label, group: "Industries" });
    }
    return list;
  }, [directory, industries]);

  const groups = useMemo(() => {
    const map = new Map<string, Option[]>();
    for (const o of options) {
      const arr = map.get(o.group) ?? [];
      arr.push(o);
      map.set(o.group, arr);
    }
    return [...map.entries()];
  }, [options]);

  const loading = profile === undefined || directory === undefined || industries === undefined;

  const onAdd = async () => {
    if (!selected) return;
    if (!requireAuth("Save your exposure profile")) return;
    const [kind, ...rest] = selected.split(":");
    const refId = rest.join(":");
    setPending(true);
    setError(null);
    try {
      await add({ kind: kind as "node" | "industry", refId });
      setSelected("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "That dependency could not be saved.",
      );
    } finally {
      setPending(false);
    }
  };

  const onRemove = async (id: Id<"exposureDeps">) => {
    setError(null);
    try {
      await remove({ id });
    } catch {
      setError("That entry could not be removed. Try again in a moment.");
    }
  };

  const entries = profile?.entries ?? [];
  const total = profile?.declaredCount ?? 0;

  return (
    <ExecCard bodyClassName="flex flex-col">
      <SectionTitle
        meta={
          loading
            ? "loading"
            : isAuthenticated
              ? `${total} of ${MAX_DEPENDENCIES} declared`
              : "sign in to declare"
        }
        right={
          <span className="exec-label text-[var(--exec-violet)]">
            USER-PROVIDED
          </span>
        }
      >
        Your exposure profile
      </SectionTitle>

      {loading ? (
        <div className="space-y-2 p-4">
          <span className="shimmer block h-4 w-2/3" />
          <span className="shimmer block h-9 w-full" />
        </div>
      ) : !isAuthenticated ? (
        <div className="flex flex-col items-start gap-3 p-4">
          <p className="max-w-xl text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
            Tell GlobalMatrix what <em>you</em> depend on — the countries,
            chokepoints and industries your work actually touches — and it will
            show which events in the corpus reach them. Nothing is inferred: only
            what you declare is reported, and it is stored against your account.
          </p>
          <button
            type="button"
            onClick={() => requireAuth("Save your exposure profile")}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--exec-ink)] px-4 py-2.5 text-[13px] font-semibold text-[var(--exec-base)] transition-opacity hover:opacity-90"
          >
            <LogIn className="size-3.5" /> Sign in to declare
          </button>
        </div>
      ) : (
        <>
          {/* Declaration form. The select is the picker; the model validates the
              id server-side, so an unknown entity is refused rather than saved. */}
          <div className="flex flex-col gap-2 border-b border-[var(--exec-hairline)] p-4">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label htmlFor="exposure-dep" className="sr-only">
                Declare a dependency
              </label>
              <select
                id="exposure-dep"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-[var(--exec-hairline-strong)] bg-transparent px-3 py-2 text-[13px] text-[var(--exec-ink)]"
              >
                <option value="" className="bg-[var(--exec-base)]">
                  Choose a country, chokepoint or industry…
                </option>
                {groups.map(([group, items]) => (
                  <optgroup key={group} label={group}>
                    {items.map((o) => (
                      <option
                        key={o.value}
                        value={o.value}
                        className="bg-[var(--exec-base)]"
                      >
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void onAdd()}
                disabled={!selected || pending || total >= MAX_DEPENDENCIES}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--exec-cyan)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-cyan)] transition-opacity enabled:hover:opacity-80 disabled:opacity-40"
              >
                <Plus className="size-3.5" />
                {pending ? "Saving…" : "Declare"}
              </button>
            </div>
            {total >= MAX_DEPENDENCIES ? (
              <p className="text-[12px] leading-relaxed text-[var(--exec-amber)]">
                A profile is limited to {MAX_DEPENDENCIES} dependencies. Remove
                one to add another.
              </p>
            ) : null}
            {error ? (
              <p className="text-[12px] leading-relaxed text-[var(--exec-crimson)]">
                {error}
              </p>
            ) : null}
          </div>

          {entries.length === 0 ? (
            <p className="p-4 text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
              Nothing declared yet. Pick something above and GlobalMatrix will
              show every event in the corpus that reaches it, with the channel
              and the expected lag.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {entries.map((entry) => (
                <li key={entry.id} className="min-w-0 px-4 py-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="min-w-0 truncate text-[14px] font-semibold text-[var(--exec-ink)]">
                        {entry.match?.label ?? entry.refId}
                      </p>
                      <p className="exec-label mt-0.5">
                        {entry.kind === "node" ? "Node" : "Industry"} ·{" "}
                        {entry.refId}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link
                        to={
                          entry.kind === "node"
                            ? `/app/country/${entry.refId}`
                            : `/app/industry/${entry.refId}`
                        }
                        aria-label={`Open ${entry.match?.label ?? entry.refId}`}
                        className="flex size-7 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${entry.match?.label ?? entry.refId}`}
                        onClick={() => void onRemove(entry.id)}
                        className="flex size-7 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-crimson)]"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {entry.match ? (
                    <>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="exec-label w-16 shrink-0">
                          exposure
                        </span>
                        <div className="min-w-0 flex-1">
                          <Bar
                            value={entry.match.load}
                            tone="var(--exec-cyan)"
                            height={5}
                          />
                        </div>
                        <span className="exec-num w-10 shrink-0 text-right text-[12px] font-semibold text-[var(--exec-ink)]">
                          {pct(entry.match.load)}
                        </span>
                      </div>

                      {entry.match.topEvents.length === 0 ? (
                        <p className="mt-2 border-l-2 border-[var(--exec-hairline-strong)] pl-3 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
                          No event in the current corpus reaches this
                          dependency. It is tracked, and nothing is shown in its
                          place.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {entry.match.topEvents.map((ev) => (
                            <li
                              key={`${ev.eventId}-${ev.channel}-${ev.viaNodeLabel}`}
                              className="min-w-0 border-l-2 border-[var(--exec-hairline-strong)] pl-3"
                            >
                              <Link
                                to={`/app/event/${ev.eventId}`}
                                className="block min-w-0 truncate text-[13px] text-[var(--exec-ink)] transition-colors hover:text-[var(--exec-cyan)]"
                              >
                                {ev.title}
                              </Link>
                              <p className="exec-label-muted mt-0.5">
                                {CHANNEL_LABEL[ev.channel]} · via{" "}
                                {ev.viaNodeLabel} · lag {ev.lagDays[0]}–
                                {ev.lagDays[1]}d · contribution{" "}
                                {pct(ev.contribution)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
                      The model has no current reading for this id.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="border-t border-[var(--exec-hairline)] px-4 py-3 text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
            These dependencies are{" "}
            <strong className="font-semibold text-[var(--exec-ink)]">
              user-provided
            </strong>{" "}
            — you declared them, the product did not infer them. Exposure and
            events are MODEL OUTPUT resolved from the scenario corpus against the
            entity you named; no company or supplier feed is connected, and no
            dependency you did not declare is ever assumed.
          </p>
        </>
      )}
    </ExecCard>
  );
}
