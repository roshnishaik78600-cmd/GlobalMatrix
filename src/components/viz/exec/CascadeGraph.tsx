import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CHANNEL_LABEL } from "@/lib/intel/types";
import { pct } from "@/lib/format";
import { loadColour } from "./Topology";
import { NoDataAvailable, SectionTitle } from "./system";

/**
 * Impact propagation graph.
 *
 * The signature GlobalMatrix view: an event at the centre, the channels and
 * infrastructure it travels through in the first ring, the economies it exposes
 * in the second, and the industries it reaches in the third. Primary, secondary
 * and tertiary effects are separated by ring rather than by colour, so the order
 * of transmission is legible before any text is read.
 *
 * Every relationship is the model's own, taken straight off this event's
 * pathways. Clicking a node states what the relationship is, how strong it is
 * and how confident the corpus is — and states that it is a modelled link rather
 * than an observation.
 */
interface CascadeNode {
  id: string;
  label: string;
  ring: 0 | 1 | 2 | 3;
  weight: number;
  note: string;
  lag?: [number, number];
  confidence?: number;
  /** Set where a node links to a full profile. */
  href?: string;
}

const RING_LABEL = ["Event", "Channel & route", "Exposed economy", "Industry"];

export function CascadeGraph({ eventId }: { eventId: string }) {
  const chain = useQuery(api.intel.eventChain, { eventId });
  const [picked, setPicked] = useState<string | null>(null);

  const nodes = useMemo<CascadeNode[]>(() => {
    if (!chain) return [];
    const out: CascadeNode[] = [
      {
        id: "event",
        label: chain.event.title,
        ring: 0,
        weight: 1,
        note: `Detected ${chain.event.detectedAt} · ${chain.event.reference}`,
      },
    ];

    // Ring 1: the channels the corpus actually carries this event on. Only the
    // channels with rows are shown — an empty channel is not a weak channel.
    const carried = (["trade", "energy"] as const).filter(
      (c) => channelRows(chain, c).length > 0,
    );
    for (const channel of carried) {
      const rows = channelRows(chain, channel);
      const mass = rows.reduce((s, r) => s + r.impact * r.confidence, 0);
      out.push({
        id: `channel:${channel}`,
        label: CHANNEL_LABEL[channel],
        ring: 1,
        weight: mass,
        note: `Transmission channel carried by ${rows.length} ${
          rows.length === 1 ? "pathway" : "pathways"
        } on this event.`,
        lag: rows[0]?.lagDays,
        confidence: rows[0]?.confidence,
      });
    }
    // Infrastructure is the route-disruption step, carrying its own mechanism.
    for (const row of chain.supply.slice(0, 4)) {
      const via = rowsForNode(chain, row.nodeId)[0];
      out.push({
        id: `route:${row.nodeId}`,
        label: row.label,
        ring: 1,
        weight: (via?.impact ?? row.impact) * (via?.confidence ?? row.confidence),
        note: via?.mechanism ?? row.note,
        lag: via?.lagDays,
        confidence: via?.confidence,
        href: `/app/country/${row.nodeId}`,
      });
    }

    // Ring 2: the economies it exposes.
    for (const row of chain.countries.slice(0, 8)) {
      out.push({
        id: `node:${row.nodeId}`,
        label: row.label,
        ring: 2,
        weight: row.load,
        note: "Economy exposed by this event's pathways, weighted by impact × confidence.",
        href: `/app/country/${row.nodeId}`,
      });
    }

    // Ring 3: the industries it reaches, through their structural share.
    for (const row of chain.industries.slice(0, 8)) {
      out.push({
        id: `industry:${row.id}`,
        label: row.label,
        ring: 3,
        weight: row.share,
        note: "Sector reached through this event's exposure to its producers and routes.",
        href: `/app/industry/${row.id}`,
      });
    }
    return out;
  }, [chain]);

  if (!chain) {
    return (
      <NoDataAvailable
        title="Resolving the propagation graph"
        reason="The cascade is read straight off this event's pathways. Nothing is drawn until they resolve."
      />
    );
  }
  if (nodes.length <= 1) {
    return (
      <NoDataAvailable
        title="This event exposes nothing the model can route"
        reason="Propagation is derived from the pathways attached to this event. It has none, so the cascade is empty — an absence, not a rendering failure."
      />
    );
  }

  // Peak per ring, so a quiet ring's members stay visible instead of collapsing
  // against one dominant ring.
  const peakByRing = [0, 1, 2, 3].map(
    (ring) =>
      Math.max(
        ...nodes.filter((n) => n.ring === ring).map((n) => n.weight),
        0.0001,
      ),
  );

  const W = 760;
  const H = 640;
  const cx = W / 2;
  const cy = H / 2;
  const radii = [0, 120, 218, 302];

  const placed = nodes.map((n) => {
    const members = nodes.filter((m) => m.ring === n.ring);
    const angle = (members.indexOf(n) / members.length) * Math.PI * 2 - Math.PI / 2;
    const scale = n.ring === 0 ? 1 : n.weight / peakByRing[n.ring];
    return {
      ...n,
      x: cx + Math.cos(angle) * radii[n.ring],
      y: cy + Math.sin(angle) * radii[n.ring],
      radius: n.ring === 0 ? 24 : 5 + scale * 10,
      scale,
    };
  });

  const selected = placed.find((n) => n.id === picked) ?? placed[0];

  return (
    <div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[38rem]"
          role="img"
          aria-label={`Propagation graph for ${chain.event.title}. ${nodes.length} nodes across three effect rings.`}
        >
          {radii.slice(1).map((r, i) => (
            <g key={r}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="var(--exec-hairline)"
                strokeWidth={1}
                strokeDasharray="2 5"
              />
              <text
                x={cx}
                y={cy - r - 5}
                textAnchor="middle"
                className="exec-label"
                fill="var(--exec-ink-dim)"
              >
                {RING_LABEL[i + 1]}
              </text>
            </g>
          ))}

          {/* Edges run from the previous ring outward, so the cascade reads in
              one direction instead of becoming an undirected hairball. */}
          {placed
            .filter((n) => n.ring > 0)
            .map((n) => {
              const anchor =
                n.ring === 1
                  ? placed[0]
                  : n.ring === 2
                    ? placed.find((p) => p.ring === 1)!
                    : placed.find((p) => p.ring === 2)!;
              const active = selected.id === n.id || selected.id === anchor.id;
              return (
                <line
                  key={`e-${n.id}`}
                  x1={anchor.x}
                  y1={anchor.y}
                  x2={n.x}
                  y2={n.y}
                  stroke={active ? "var(--exec-cyan)" : "var(--exec-hairline)"}
                  strokeWidth={active ? 1.4 : 0.8}
                  opacity={active ? 0.9 : 0.45}
                />
              );
            })}

          {placed.map((n) => {
            const isSelected = selected.id === n.id;
            const colour = n.ring === 0 ? "var(--exec-cyan)" : loadColour(Math.min(1, n.scale));
            return (
              <g
                key={n.id}
                onClick={() => setPicked(n.id)}
                className="cursor-pointer"
              >
                {n.ring === 0 ? (
                  <circle cx={n.x} cy={n.y} r={n.radius} fill={colour} opacity={0.2} />
                ) : null}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.radius}
                  fill={n.ring === 0 ? colour : "var(--exec-base)"}
                  stroke={colour}
                  strokeWidth={isSelected ? 2 : 1.2}
                />
                <text
                  x={n.x}
                  y={n.y + n.radius + 10}
                  textAnchor="middle"
                  className="exec-num"
                  fill={isSelected ? "var(--exec-ink)" : "var(--exec-ink-dim)"}
                  style={{
                    fontSize: 9.5,
                    paintOrder: "stroke",
                    stroke: "var(--exec-base)",
                    strokeWidth: 3,
                  }}
                >
                  {n.label.length > 22 ? `${n.label.slice(0, 21)}…` : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="border-t border-[var(--exec-hairline)] px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <span className="text-[12.5px] font-semibold text-[var(--exec-ink)]">
            {selected.label}
          </span>
          <span className="exec-label">
            {RING_LABEL[selected.ring]} · weight {selected.weight.toFixed(3)}
          </span>
          {selected.lag ? (
            <span className="exec-num text-[10px] text-[var(--exec-ink-dim)]">
              lag {selected.lag[0]}–{selected.lag[1]}d · confidence{" "}
              {pct(selected.confidence ?? 0)}
            </span>
          ) : null}
          <span className="basis-normal-case text-[11px] text-[var(--exec-ink-dim)]">
            {selected.note}
          </span>
          {selected.href ? (
            <Link
              to={selected.href}
              className="exec-label ml-auto transition-colors hover:text-[var(--exec-ink)]"
            >
              Open →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** The per-channel pathway rows this query returns. */
type ChannelRow = {
  nodeId: string;
  channel: string;
  mechanism: string;
  lagDays: [number, number];
  confidence: number;
  impact: number;
};

type Chain = {
  trade: ChannelRow[];
  energy: ChannelRow[];
};

/** One channel's pathways. Only trade and energy are returned as own stages. */
function channelRows(chain: Chain, channel: "trade" | "energy"): ChannelRow[] {
  const source = channel === "trade" ? chain.trade : chain.energy;
  return source.filter((r) => r.channel === channel);
}

/** The pathway row that explains why a given infrastructure node is exposed. */
function rowsForNode(chain: Chain, nodeId: string): ChannelRow[] {
  return chain.trade.concat(chain.energy).filter((r) => r.nodeId === nodeId);
}

export function CascadeHeader({
  title,
  meta,
  right,
}: {
  title: string;
  meta: string;
  right?: ReactNode;
}) {
  return (
    <SectionTitle meta={meta} right={right}>
      {title}
    </SectionTitle>
  );
}
