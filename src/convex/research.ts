import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

const requireUser = async (ctx: { auth: unknown }) => {
  const userId = await getAuthUserId(ctx as Parameters<typeof getAuthUserId>[0]);
  if (!userId) throw new Error("You must be signed in to track events.");
  return userId;
};

/** Add or remove an event from the researcher's watchlist. */
export const toggleWatch = mutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("watchlist")
      .withIndex("by_user_event", (q) =>
        q.eq("userId", userId).eq("eventId", args.eventId),
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { watched: false };
    }

    await ctx.db.insert("watchlist", {
      userId,
      eventId: args.eventId,
      createdAt: Date.now(),
    });
    return { watched: true };
  },
});

/** Attach a research annotation to an event. */
export const addAnnotation = mutation({
  args: { eventId: v.string(), body: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const body = args.body.trim();
    if (!body) throw new Error("Annotation cannot be empty.");
    if (body.length > 2000) throw new Error("Annotation is limited to 2000 characters.");
    await ctx.db.insert("annotations", {
      userId,
      eventId: args.eventId,
      body,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Delete one of the researcher's own annotations. */
export const deleteAnnotation = mutation({
  args: { annotationId: v.id("annotations") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const row = await ctx.db.get(args.annotationId);
    if (!row || row.userId !== userId) throw new Error("Not your annotation.");
    await ctx.db.delete(args.annotationId);
    return { ok: true };
  },
});