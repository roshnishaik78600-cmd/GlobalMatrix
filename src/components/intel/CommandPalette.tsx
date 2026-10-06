import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { api } from "@/convex/_generated/api";
import { SOURCES } from "@/lib/sources";
import { STAGE_LABEL } from "@/lib/intel/types";
import { pct } from "@/lib/format";

type Entry = {
  kind:
    | "event"
    | "country"
    | "industry"
    | "company"
    | "infrastructure"
    | "source"
    | "screen";
  id: string;
  label: string;
  hint: string;
  meta: string;
  to: string;
};

/** Result groups, in the order a reader narrows a question. */
const GROUPS = [
  { kind: "event", label: "Events", tag: "EVT" },
  { kind: "country", label: "Countries", tag: "CTRY" },
  { kind: "industry", label: "Industries", tag: "SECT" },
  { kind: "company", label: "Companies", tag: "CO" },
  { kind: "infrastructure", label: "Infrastructure", tag: "INFRA" },
  { kind: "source", label: "Sources", tag: "SRC" },
  { kind: "screen", label: "Screens", tag: "GO" },
] as const;

/**
 * Companies are a group, not an omission. No issuer-level data is connected,
 * so the group's single entry states that with its reason and links to the page
 * that explains it — the same rule the navigation follows. The keywords live in
 * the hint so searching "company", "firm", "supplier" or "issuer" surfaces the
 * honest answer instead of a dead empty result.
 */
const COMPANIES: Entry[] = [
  {
    kind: "company",
    id: "companies",
    label: "Companies",
    hint: "no company, firm, supplier or issuer data connected in this build",
    meta: "unavailable",
    to: "/app/companies",
  },
];

/**
 * Domains a reader will reasonably search for that this build does not measure.
 *
 * They are listed rather than missing, so searching "commodity" returns an
 * honest answer with a link to the page that explains why — instead of a dead
 * search result that reads like the data does not exist.
 */
const SCREENS: Entry[] = [
  {
    kind: "screen",
    id: "chain",
    label: "Event → world",
    hint: "follow one event through every layer it touches",
    meta: "",
    to: "/app/chain",
  },
  {
    kind: "screen",
    id: "sources",
    label: "Data sources",
    hint: "what is connected, what is fresh, what it cannot prove",
    meta: "",
    to: "/app/data",
  },
  {
    kind: "screen",
    id: "trade",
    label: "Trade",
    hint: "reported merchandise values, UN Comtrade",
    meta: "",
    to: "/app/trade",
  },
  {
    kind: "screen",
    id: "markets",
    label: "Markets",
    hint: "reported growth and coverage — no price feed connected",
    meta: "",
    to: "/app/markets",
  },
  {
    kind: "screen",
    id: "commodities",
    label: "Commodities",
    hint: "not measured in this build",
    meta: "empty",
    to: "/app/trade",
  },
  {
    kind: "screen",
    id: "policy",
    label: "Policy registry",
    hint: "not measured in this build",
    meta: "empty",
    to: "/app/policy",
  },
];

/**
 * Global jump-to. A researcher working an event, a country and a sector at the
 * same time should never have to navigate to move between them.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();

  const feed = useQuery(api.intel.detectionFeed, {});
  const countries = useQuery(api.intel.countryDirectory);
  const industries = useQuery(api.intel.industryDirectory);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        onOpenChange(!open);
        return;
      }
      // "/" jumps to search the way it does in most consoles, but never while
      // the reader is typing into something.
      if (event.key === "/" && !open) {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        ) {
          return;
        }
        event.preventDefault();
        onOpenChange(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    for (const row of feed?.rows ?? []) {
      out.push({
        kind: "event",
        id: row.id,
        label: row.title,
        hint: `${row.reference} · ${STAGE_LABEL[row.stage]}`,
        meta: `30d ${row.score30.toFixed(1)}`,
        to: `/app/event/${row.id}`,
      });
    }
    for (const row of countries?.countries ?? []) {
      out.push({
        kind: "country",
        id: row.nodeId,
        label: row.label,
        hint: `${row.short} · ${row.region}`,
        meta: `${pct(row.load)} load`,
        to: `/app/country/${row.nodeId}`,
      });
    }
    for (const row of countries?.corridors ?? []) {
      out.push({
        kind: "infrastructure",
        id: row.nodeId,
        label: row.label,
        hint: `${row.short} · ${row.kind} · ${row.region}`,
        meta: `${pct(row.load)} load`,
        to: `/app/country/${row.nodeId}`,
      });
    }
    for (const row of industries?.industries ?? []) {
      out.push({
        kind: "industry",
        id: row.id,
        label: row.label,
        hint: row.code,
        meta: `${pct(row.load)} load`,
        to: `/app/industry/${row.id}`,
      });
    }
    // Connected evidence sources, searchable by publisher, dataset or what
    // they cover — each one landing on the observability dashboard.
    for (const source of Object.values(SOURCES)) {
      out.push({
        kind: "source",
        id: source.id,
        label: source.label,
        hint: `${source.publisher} · ${source.dataType}`,
        meta: "evidence",
        to: "/app/data",
      });
    }
    out.push(...COMPANIES);
    out.push(...SCREENS);
    return out;
  }, [feed, countries, industries]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Search events, countries, industries, infrastructure and sources."
      className="rounded-none border-rule"
    >
      <CommandInput
        placeholder="Search India, Hormuz, semiconductors, shipping, World Bank…"
        className="h-11 border-b border-rule"
      />
      <CommandList className="max-h-[440px]">
        <CommandEmpty>
          <span className="label text-muted-foreground">
            Nothing in the corpus matches that.
          </span>
        </CommandEmpty>
        {GROUPS.map((group, gi) => {
          const items = entries.filter((e) => e.kind === group.kind);
          if (items.length === 0) return null;
          return (
            <div key={group.kind}>
              {gi > 0 ? <CommandSeparator className="h-px bg-rule" /> : null}
              <CommandGroup
                heading={`${group.label} · ${items.length}`}
                className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {items.map((entry) => (
                  <CommandItem
                    key={`${entry.kind}-${entry.id}`}
                    value={`${entry.kind} ${entry.id} ${entry.label} ${entry.hint}`}
                    onSelect={() => {
                      onOpenChange(false);
                      navigate(entry.to);
                    }}
                    className="cursor-pointer gap-3 rounded-none px-3 py-2.5 data-[selected=true]:bg-foreground data-[selected=true]:text-background"
                  >
                    <span className="label w-[42px] shrink-0 text-[12px] text-signal">
                      {group.tag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {entry.label}
                      </span>
                      <span className="block truncate text-[12px] opacity-70">
                        {entry.hint}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[12px] opacity-70">
                      {entry.meta}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
      <div className="flex items-center justify-between border-t border-rule px-3 py-2">
        <span className="label text-muted-foreground">
          {entries.length} indexed entities
        </span>
        <span className="label text-muted-foreground">
          ⌘K or / to search · esc to close · esc anywhere clears a selection
        </span>
      </div>
    </CommandDialog>
  );
}