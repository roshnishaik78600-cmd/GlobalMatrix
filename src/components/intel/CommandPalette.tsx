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
import { STAGE_LABEL } from "@/lib/intel/types";
import { pct } from "@/lib/format";

type Entry = {
  kind: "event" | "country" | "industry";
  id: string;
  label: string;
  hint: string;
  meta: string;
  to: string;
};

const GROUPS = [
  { kind: "event", label: "Events", tag: "EVT" },
  { kind: "country", label: "Countries & infrastructure", tag: "NODE" },
  { kind: "industry", label: "Industries", tag: "SECT" },
] as const;

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
        kind: "country",
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
    return out;
  }, [feed, countries, industries]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Jump to"
      description="Search events, countries and industries."
      className="rounded-none border-rule"
    >
      <CommandInput
        placeholder="Search the graph…"
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
                    className="cursor-pointer gap-3 rounded-none px-3 py-2.5 data-[selected=true]:bg-ink data-[selected=true]:text-paper"
                  >
                    <span className="label w-[42px] shrink-0 text-[9px] text-signal">
                      {group.tag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">
                        {entry.label}
                      </span>
                      <span className="block truncate text-[10px] opacity-70">
                        {entry.hint}
                      </span>
                    </span>
                    <span className="num shrink-0 text-[10px] opacity-70">
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
          ⌘K to toggle · esc to close
        </span>
      </div>
    </CommandDialog>
  );
}