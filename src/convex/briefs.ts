import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Spends one throttle slot for a model-generated brief, or refuses.
 *
 * This is the abuse guard on the only action in the product that costs real
 * money per call. Convex mutations are transactional and re-run on write
 * conflicts, so two simultaneous requests for the same user cannot both read
 * the same timestamp and both proceed: the second one retries, sees the claim
 * the first one wrote, and is refused. That is why the check and the write live
 * in a mutation together rather than either side of the upstream fetch.
 *
 * Returning a refusal rather than throwing keeps it inline with the action's
 * other structured outcomes — a rate limit is an ordinary state, not a fault.
 */
export const claimBrief = internalMutation({
  args: { userId: v.id("users"), minIntervalMs: v.number() },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true } | { ok: false; retryInMs: number }> => {
    const now = Date.now();
    const prior = await ctx.db
      .query("briefClaims")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .first();

    if (prior) {
      const wait = args.minIntervalMs - (now - prior.at);
      if (wait > 0) return { ok: false, retryInMs: wait };
    }

    await ctx.db.insert("briefClaims", { userId: args.userId, at: now });
    return { ok: true };
  },
});

/**
 * Persists a generated brief. Internal so that only the action layer can
 * write briefs — the mutation is never exposed to the client directly.
 */
export const store = internalMutation({
  args: {
    userId: v.id("users"),
    eventId: v.string(),
    thesis: v.string(),
    channels: v.array(v.string()),
    caveats: v.array(v.string()),
    model: v.string(),
    corpusVersion: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("briefs")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", args.userId).eq("eventId", args.eventId),
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("briefs", args);
    return args.createdAt;
  },
});