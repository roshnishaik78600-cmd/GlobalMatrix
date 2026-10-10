import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { allAssessments } from "../lib/intel/engine";
import { SCENARIOS } from "../lib/intel/scenarios";
import {
  MAX_DEPENDENCIES,
  MAX_DEPENDENCY_ID,
  matchDependencies,
  resolveDependency,
  type DeclaredDependency,
  type DependencyMatch,
} from "../lib/intel/profile";

/**
 * A reader's declared exposure profile.
 *
 * The product cannot measure which countries, chokepoints and sectors a
 * particular reader depends on — no company or supplier feed is connected, and
 * inventing one would be the single worst thing this application could do. So
 * the reader states their own dependencies and this module reports which events
 * in the corpus reach them.
 *
 * Three properties are deliberate:
 *
 * 1. **The declaration is only a pointer.** `addDependency` validates the id
 *    against the model (`resolveDependency`) and stores nothing but the kind and
 *    id. The label, the exposure and the events are all resolved server-side
 *    from the corpus, so a client can never store a fabricated entity or a
 *    hand-authored risk figure.
 * 2. **It is owner-scoped.** Every row is keyed to the authenticated user, the
 *    read query returns nothing when signed out, and the delete checks
 *    ownership — the same isolation the watchlist uses.
 * 3. **It is bounded.** `MAX_DEPENDENCIES` caps a profile and the id length is
 *    capped, so a signed-in account cannot use this table as free storage.
 */

const kindValidator = v.union(v.literal("node"), v.literal("industry"));

export interface ExposureProfileEntry {
  id: Id<"exposureDeps">;
  kind: "node" | "industry";
  refId: string;
  /** `match` is null only if the corpus momentarily has nothing for the id. */
  match: DependencyMatch | null;
}

/**
 * The reader's profile and the events reaching it, in one round trip.
 *
 * Returns `signedIn: false` with empty lists rather than an error, because a
 * signed-out visitor reaching this panel is an ordinary state and the UI says
 * so plainly instead of showing a failure.
 */
export const listProfile = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    signedIn: boolean;
    entries: ExposureProfileEntry[];
    declaredCount: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { signedIn: false, entries: [], declaredCount: 0 };

    const rows = await ctx.db
      .query("exposureDeps")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const declared: DeclaredDependency[] = rows.map((r) => ({
      kind: r.kind,
      refId: r.refId,
    }));
    const matched = new Map(
      matchDependencies(declared, allAssessments(SCENARIOS)).map((m) => [
        `${m.kind}:${m.refId}`,
        m,
      ]),
    );

    const entries: ExposureProfileEntry[] = rows
      .map((r) => ({
        id: r._id,
        kind: r.kind,
        refId: r.refId,
        match: matched.get(`${r.kind}:${r.refId}`) ?? null,
      }))
      .sort((a, b) => (b.match?.load ?? -1) - (a.match?.load ?? -1));

    return { signedIn: true, entries, declaredCount: entries.length };
  },
});

/**
 * Declare one dependency.
 *
 * Idempotent: declaring the same entity twice is a no-op rather than a
 * duplicate row, so a double tap cannot fill the profile. Throws only for the
 * three things a caller can actually get wrong — no account, a malformed id, an
 * id the model does not track — and rejects the last of those rather than
 * storing a pointer that would render as a placeholder.
 */
export const addDependency = mutation({
  args: { kind: kindValidator, refId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to save an exposure profile.");
    }

    const refId = args.refId.trim();
    if (!refId || refId.length > MAX_DEPENDENCY_ID) {
      throw new Error("That is not a valid GlobalMatrix reference.");
    }
    if (!resolveDependency(args.kind, refId)) {
      throw new Error(
        "That dependency is not tracked by the model, so it cannot be saved.",
      );
    }

    const existing = await ctx.db
      .query("exposureDeps")
      .withIndex("by_user_ref", (q) =>
        q.eq("userId", userId).eq("kind", args.kind).eq("refId", refId),
      )
      .first();
    if (existing) return { ok: true, id: existing._id, added: false };

    const rows = await ctx.db
      .query("exposureDeps")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (rows.length >= MAX_DEPENDENCIES) {
      throw new Error(
        `An exposure profile is limited to ${MAX_DEPENDENCIES} dependencies.`,
      );
    }

    const id = await ctx.db.insert("exposureDeps", {
      userId,
      kind: args.kind,
      refId,
      createdAt: Date.now(),
    });
    return { ok: true, id, added: true };
  },
});

/** Remove one of the reader's own declarations. */
export const removeDependency = mutation({
  args: { id: v.id("exposureDeps") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to edit your profile.");
    const row = await ctx.db.get(args.id);
    if (!row || row.userId !== userId) {
      throw new Error("Not your exposure profile entry.");
    }
    await ctx.db.delete(args.id);
    return { ok: true };
  },
});
