"use node";

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { allAssessments } from "../lib/intel/engine";
import { SCENARIOS, CORPUS_VERSION } from "../lib/intel/scenarios";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";

const MODEL = "claude-sonnet-4-5";
const ENDPOINT = "https://api.anthropic.com/v1/messages";

type BriefShape = {
  thesis: string;
  channels: string[];
  caveats: string[];
};

type BriefFailureReason = "missing_key" | "upstream_error" | "empty_response" | "unparseable";

type BriefActionResult =
  | { ok: true; brief: BriefShape; createdAt: number }
  | { ok: false; reason: BriefFailureReason; message: string };

/**
 * Generates an analyst brief for one event from the model's own computed
 * evidence set.
 *
 * The brief is deliberately constrained: Claude may only re-weigh and narrate
 * evidence the deterministic engine already surfaced, and every brief carries
 * the caveat list the model was required to produce. If no API key is present
 * the action returns a structured error rather than a degraded answer.
 */
export const generateBrief = action({
  args: { eventId: v.string() },
  handler: async (ctx, args): Promise<BriefActionResult> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to generate a brief.");

    const assessment = allAssessments(SCENARIOS).find(
      (a) => a.scenario.id === args.eventId,
    );
    if (!assessment) throw new Error("Unknown event.");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        reason: "missing_key" as const,
        message:
          "Add ANTHROPIC_API_KEY in the project's Keys tab to generate model-written briefs.",
      };
    }

    const prompt = buildPrompt(assessment);

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1400,
        system:
          "You are a geopolitical risk analyst supporting academic researchers. " +
          "You write in plain, calibrated prose. You never introduce facts that are " +
          "not present in the supplied evidence set, and you always state what would " +
          "falsify your reading.",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[brief] anthropic error", response.status, detail);
      return {
        ok: false as const,
        reason: "upstream_error" as const,
        message: `Claude returned ${response.status}. Try again in a moment.`,
      };
    }

    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text =
      payload.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
    if (!text) {
      return {
        ok: false as const,
        reason: "empty_response" as const,
        message: "Claude returned an empty response.",
      };
    }

    const parsed = parseBrief(text);
    if (!parsed) {
      return {
        ok: false as const,
        reason: "unparseable" as const,
        message:
          "Claude did not return the expected structure. Retry, or read the evidence ledger instead.",
      };
    }

    const createdAt: number = await ctx.runMutation(internal.briefs.store, {
      userId,
      eventId: args.eventId,
      thesis: parsed.thesis,
      channels: parsed.channels,
      caveats: parsed.caveats,
      model: MODEL,
      corpusVersion: CORPUS_VERSION,
      createdAt: Date.now(),
    });

    return { ok: true as const, brief: parsed, createdAt };
  },
});

function buildPrompt(assessment: {
  scenario: (typeof SCENARIOS)[number];
  risk: Record<number, { score: number; low: number; high: number }>;
  channelPressure: Record<string, number>;
  dominantChannel: string;
}): string {
  const s = assessment.scenario;
  const r30 = assessment.risk[30];

  const evidence = s.signals
    .map(
      (sig) =>
        `- [${sig.sourceClass}/${sig.channel}] ${sig.observedAt} · ${sig.source}: ${sig.headline} (reliability ${(sig.reliability * 100).toFixed(0)}%, ${sig.corroborations} corroborations, ${sig.anomalyZ}σ)`,
    )
    .join("\n");

  const channels = Object.entries(assessment.channelPressure)
    .map(
      ([channel, pressure]) =>
        `- ${channel}: pressure ${(pressure * 100).toFixed(0)}%`,
    )
    .join("\n");

  return [
    `EVENT: ${s.title}`,
    `REFERENCE: ${s.reference}`,
    `STAGE: ${s.stage} · confidence ${(s.confidence * 100).toFixed(0)}% · novelty ${(s.novelty * 100).toFixed(0)}%`,
    `ACTORS: ${s.actors.join(", ")}`,
    `SUMMARY: ${s.summary}`,
    ``,
    `MODEL OUTPUT (deterministic, do not contradict):`,
    `30-day risk ${r30.score.toFixed(1)} (80% interval ${r30.low.toFixed(1)}–${r30.high.toFixed(1)}), dominant channel ${assessment.dominantChannel}`,
    channels,
    ``,
    `EVIDENCE LEDGER:`,
    evidence,
    ``,
    `SCENARIO TAIL: ${s.tailScenario}`,
    ``,
    `TASK: Return STRICT JSON only, no prose outside it, with exactly these keys:`,
    `{ "thesis": string, "channels": string[], "caveats": string[] }`,
    ``,
    `Rules:`,
    `- thesis: 3-5 sentences. State the dominant transmission path and what would change the estimate.`,
    `- channels: 2-4 strings, one per material channel, each naming the transmission mechanism in one sentence.`,
    `- caveats: 3-5 strings. Each must name a specific evidentiary gap, a source-class weakness, or a falsification test.`,
    `- Cite only evidence listed above. If the evidence does not support a claim, say so in caveats.`,
  ].join("\n");
}

function parseBrief(text: string): BriefShape | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<BriefShape>;
    if (typeof parsed.thesis !== "string" || !parsed.thesis.trim()) return null;
    return {
      thesis: parsed.thesis.trim(),
      channels: Array.isArray(parsed.channels)
        ? parsed.channels.filter((c): c is string => typeof c === "string")
        : [],
      caveats: Array.isArray(parsed.caveats)
        ? parsed.caveats.filter((c): c is string => typeof c === "string")
        : [],
    };
  } catch {
    return null;
  }
}