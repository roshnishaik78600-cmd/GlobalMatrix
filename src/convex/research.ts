import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

const requireUser = async (ctx: { auth: unknown }) => {
  const userId = await getAuthUserId(ctx as Parameters<typeof getAuthUserId>[0]);
  if (!userId) throw new Error("You must be signed in to track events.");
  return userId;
};

/** Add or remove an event from the researcher's watchlist.
 *
 * Event keys exist in two forms across the product — the bare scenario id and
 * the namespaced `EVENT:` id. Toggle treats them as one entry: it deletes
 * whichever form exists and always inserts the namespaced form, so a key can
 * never be added twice under two spellings and fail to turn off again. */
export const toggleWatch = mutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    // Namespaced kinds (`NODE:`, `SECTOR:`) are exact-match only.
    const isEventKey =
      !args.eventId.includes(":") || args.eventId.startsWith("EVENT:");
    const bare = args.eventId.startsWith("EVENT:")
      ? args.eventId.slice("EVENT:".length)
      : args.eventId;
    const forms = isEventKey
      ? [...new Set([args.eventId, bare, `EVENT:${bare}`])]
      : [args.eventId];

    async function findRow(form: string) {
      return ctx.db
        .query("watchlist")
        .withIndex("by_user_event", (q) =>
          q.eq("userId", userId).eq("eventId", form),
        )
        .first();
    }
    let existing: Awaited<ReturnType<typeof findRow>> = null;
    for (const form of forms) {
      const row = await findRow(form);
      if (row) {
        existing = row;
        break;
      }
    }

    if (existing) {
      await ctx.db.delete(existing._id);
      return { watched: false };
    }

    await ctx.db.insert("watchlist", {
      userId,
      eventId: isEventKey ? `EVENT:${bare}` : args.eventId,
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