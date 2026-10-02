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
    observations: defineTable({
      sourceId: v.string(),
      // Connector-specific identity, e.g. "NY.GDP.MKTP.KD.ZG" or "comtrade:2023:M".
      key: v.string(),
      // Dataset revision date reported by the source, where it publishes one.
      asOf: v.string(),
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
