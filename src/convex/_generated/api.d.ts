/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as brief from "../brief.js";
import type * as briefs from "../briefs.js";
import type * as chokepoints from "../chokepoints.js";
import type * as http from "../http.js";
import type * as intel from "../intel.js";
import type * as macroTopology from "../macroTopology.js";
import type * as observations from "../observations.js";
import type * as poll from "../poll.js";
import type * as research from "../research.js";
import type * as sources from "../sources.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  brief: typeof brief;
  briefs: typeof briefs;
  chokepoints: typeof chokepoints;
  http: typeof http;
  intel: typeof intel;
  macroTopology: typeof macroTopology;
  observations: typeof observations;
  poll: typeof poll;
  research: typeof research;
  sources: typeof sources;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
