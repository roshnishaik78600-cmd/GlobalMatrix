import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // add other tables here

    // Events a researcher is tracking. The analytical corpus itself is
    // versioned code; only researcher-owned state lives in the database.
    watchlist: defineTable({
      userId: v.id("users"),
      eventId: v.string(),
      note: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_event", ["userId", "eventId"]),

    // Free-text research annotations attached to an event.
    annotations: defineTable({
      userId: v.id("users"),
      eventId: v.string(),
      body: v.string(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_event", ["userId", "eventId"]),

    // Throttle for the model-generated brief action.
    //
    // `generateBrief` is an unauthenticated-by-cost action: it is gated on
    // sign-in, but any account can call it, and every call spends the
    // deployment's own ANTHROPIC_API_KEY. One row per accepted run is what
    // bounds that. It lives in its own table rather than on `users` so the
    // claim is a plain insert, and so no auth-owned table is written by product
    // code.
    briefClaims: defineTable({
      userId: v.id("users"),
      at: v.number(),
    }).index("by_user", ["userId"]),

    // Cached model-generated analyst briefs, one per user per event.
    briefs: defineTable({
      userId: v.id("users"),
      eventId: v.string(),
      thesis: v.string(),
      channels: v.array(v.string()),
      caveats: v.array(v.string()),
      model: v.string(),
      corpusVersion: v.string(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_event", ["userId", "eventId"]),

    // Verbatim readings pulled from named external sources, cached with the
    // provenance needed to display them honestly. `payload` is the validated,
    // JSON-serialised reading list; it is only ever written by the source
    // connectors, which refuse to store anything they could not attribute.
    //
    // This table holds SUCCESSFUL readings only, at most one row per
    // (sourceId, key). A failed run never lands here, because a failed run must
    // never overwrite the last verified value with an empty one — the failure
    // is recorded in `sourceRuns` instead and the verified reading stays on
    // screen, labelled as old rather than silently replaced.
    observations: defineTable({
      sourceId: v.string(),
      // Connector-specific identity, e.g. "NY.GDP.MKTP.KD.ZG" or "comtrade:2023:M".
      key: v.string(),
      // Dataset revision date reported by the source, where it publishes one.
      asOf: v.string(),
      // When the source says the underlying item was published, where it says.
      // Distinct from `asOf` (the period described) and from `retrievedAt`
      // (when we fetched it): GDELT stamps an article's own publication time,
      // which is neither of the other two.
      publishedAt: v.optional(v.number()),
      retrievedAt: v.number(),
      // DataStatus: observed | stale | unavailable
      status: v.string(),
      note: v.optional(v.string()),
      ok: v.boolean(),
      problem: v.optional(v.string()),
      payload: v.string(),
    })
      .index("by_source", ["sourceId"])
      .index("by_source_key", ["sourceId", "key"]),

    // The last attempt per (sourceId, key), successful or not.
    //
    // Health and the verified readings are deliberately different tables. A
    // reader needs to know both "what is the newest real value" and "did the
    // last fetch work", and a single table cannot answer both without either
    // destroying the last value on failure or hiding the failure behind a
    // successful row.
    sourceRuns: defineTable({
      sourceId: v.string(),
      key: v.string(),
      ok: v.boolean(),
      // DataStatus: observed | unavailable
      status: v.string(),
      asOf: v.string(),
      publishedAt: v.optional(v.number()),
      retrievedAt: v.number(),
      /** Readings in the latest successful payload for this key, 0 on failure. */
      readingCount: v.number(),
      problem: v.optional(v.string()),
    })
      .index("by_source", ["sourceId"])
      .index("by_source_key", ["sourceId", "key"]),

    // One row per source: the poll governor.
    //
    // This is what makes ingestion server-side rather than per-browser. A run
    // claims its source here first; every other caller — a second tab, another
    // user, a cron tick that overlaps a manual refresh — is refused until the
    // claim is released. `nextAllowedAt` carries the cooldown after a success
    // and the exponential backoff after a failure, so a rate-limited or down
    // source is asked less often instead of being hammered by every open page.
    sourceLocks: defineTable({
      sourceId: v.string(),
      /** When the in-flight run claimed the source. */
      startedAt: v.number(),
      /** Set when the run finished; absent while one is in flight. */
      finishedAt: v.optional(v.number()),
      /** Consecutive failed runs, reset to 0 by any success. */
      consecutiveFailures: v.number(),
      /** Earliest time another run may start. */
      nextAllowedAt: v.number(),
      /** Attempts and failures since the deployment was created, for the board. */
      attempts: v.number(),
      failures: v.number(),
    }).index("by_source", ["sourceId"]),

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
