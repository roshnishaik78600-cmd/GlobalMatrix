import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

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