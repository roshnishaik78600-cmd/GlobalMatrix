import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Per-user account fields for GlobalMatrix.
 *
 * The identity layer (`auth.ts`, `auth.config.ts`, `auth/emailOtp.ts`) is
 * read-only; this module only owns product-level profile data on the `users`
 * table — starting with the display name captured at signup, and later the
 * foundation for watchlists, exposure profiles and saved state.
 */

/** Trimmed display name, 2–80 characters — matches the signup form's rule. */
export const setDisplayName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in to set a name.");

    const name = args.name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80) {
      throw new Error("Name must be between 2 and 80 characters.");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Account not found.");

    await ctx.db.patch(userId, { name });
    return { ok: true };
  },
});
