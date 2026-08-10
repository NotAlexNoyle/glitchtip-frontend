import { AllAuthError } from "./api/allauth/allauth.interfaces";

export const baseUrl = "/api/0";
export const allauthBase = "/_allauth/browser/v1";
export const SERVER_ERROR = $localize`500: Internal server error. Please refresh the page and try again.`;
export const AUTH_ERROR = $localize`403: Unauthorized action. You do not have permission to perform this action.`;
export const ALLAUTH_SERVER_ERROR: AllAuthError[] = [
  { code: "unhandled_error", message: SERVER_ERROR },
];
export const UNHANDLED_ERROR = $localize`Something went wrong`;
export const ALLAUTH_UNHANDLED_ERROR: AllAuthError[] = [
  { code: "unhandled_error", message: UNHANDLED_ERROR },
];
/**
 * Mirrors the backend scope registry in apps/organizations_ext/scopes.py.
 * `as const` is required: without it Scope widens to `string` and typos in
 * scope checks silently pass type-checking.
 */
export const SCOPES = [
  "project:read",
  "project:write",
  "project:admin",
  "project:releases",
  "team:read",
  "team:write",
  "team:admin",
  "event:read",
  "event:write",
  "event:admin",
  "org:read",
  "org:write",
  "org:admin",
  "member:read",
  "member:write",
  "member:admin",
  "org:integrations",
] as const;
export type Scope = (typeof SCOPES)[number];
