/**
 * Object identity — the single source of truth for how each domain object
 * presents itself: its icon, its accent colour, and how an Issue's level/status
 * map to visual tokens.
 *
 * OOUX principle: identity is a property of the *object*, not of the component
 * that happens to render it. Every surface that shows an object (list row,
 * detail masthead, dashboard bento, nested reference) reads from here, so an
 * Issue looks and behaves like an Issue everywhere it appears.
 *
 * Before this module, level→colour was hand-rolled in two SCSS files,
 * status→icon in three templates, and the issue title derivation lived only in
 * the masthead. Consolidating them here is the whole point: change identity in
 * one place, and it changes everywhere.
 */

import { components } from "src/app/api/api-schema";

/** The canonical domain objects in the product. */
export type ObjectType =
  | "issue"
  | "event"
  | "monitor"
  | "transaction"
  | "release"
  | "project"
  | "member"
  | "team"
  | "organization";

/**
 * Base Material icon per object type — its "what am I" glyph. Used by nested
 * references (gt-object-ref) and aggregate summary cards so a given object type
 * always wears the same face.
 *
 * IMPORTANT: the app ships a *subset* Material Symbols font (~62KB), so only
 * bundled glyphs render — anything else shows as literal ligature text. These
 * are deliberately the icons the product already uses for each object (see the
 * main nav and shared/event-info), which keeps them both in-subset and true to
 * each object's established identity.
 */
export const OBJECT_ICON: Record<ObjectType, string> = {
  issue: "breaking_news",
  event: "error",
  monitor: "share_eta",
  transaction: "avg_pace",
  release: "rocket_launch",
  project: "folder",
  // A member is an individual person; `account_circle` is reserved for the
  // current user's Profile, so Member and Profile don't share a face.
  member: "person",
  team: "group",
  organization: "account_tree",
};

// --- Issue level identity ---------------------------------------------------

/** "sample" | "debug" | "info" | "warning" | "error" | "fatal" */
export type IssueLevel = components["schemas"]["LogLevelDisplay"];

export interface LevelToken {
  /** CSS value carrying the accent colour. */
  readonly color: string;
  /** Human label — drives accessible names so level is never colour-only. */
  readonly label: string;
  /** Ordering for "most severe wins" when summarising a collection. */
  readonly severity: number;
  /** Fatal reads as a striped bar — the one genuinely exceptional treatment. */
  readonly striped: boolean;
}

export const ISSUE_LEVEL: Record<IssueLevel, LevelToken> = {
  sample: { color: "var(--mat-sys-outline)", label: "Sample", severity: 0, striped: false },
  debug: { color: "var(--mat-sys-outline-variant)", label: "Debug", severity: 1, striped: false },
  info: { color: "var(--info-color)", label: "Info", severity: 2, striped: false },
  warning: { color: "var(--warning-color)", label: "Warning", severity: 3, striped: false },
  error: { color: "var(--mat-sys-error)", label: "Error", severity: 4, striped: false },
  fatal: { color: "var(--mat-sys-error)", label: "Fatal", severity: 5, striped: true },
};

/** Resolve a level string (untyped from the API) to its identity token. */
export function issueLevelToken(level: string | null | undefined): LevelToken {
  return ISSUE_LEVEL[(level ?? "error") as IssueLevel] ?? ISSUE_LEVEL.error;
}

// --- Issue status identity --------------------------------------------------

/** "unresolved" | "resolved" | "ignored" */
export type IssueStatus = components["schemas"]["EventStatusDisplay"];

export interface StatusToken {
  readonly icon: string;
  readonly label: string;
}

export const ISSUE_STATUS: Record<IssueStatus, StatusToken> = {
  unresolved: { icon: "priority_high", label: "Unresolved" },
  resolved: { icon: "done", label: "Resolved" },
  ignored: { icon: "notifications_off", label: "Ignored" },
};

/** Resolve a status string to its identity token. */
export function issueStatusToken(status: string | null | undefined): StatusToken {
  return (
    ISSUE_STATUS[(status ?? "unresolved") as IssueStatus] ??
    ISSUE_STATUS.unresolved
  );
}

// --- Monitor status identity ------------------------------------------------
//
// EXPERIMENT (see docs/ooux/identity-implementation.md): Issue identity is a
// *severity scale*; Monitor identity is a *nullable boolean* — `isUp` is
// true (up) / false (down) / null (no data yet). It resolves to a named state
// and reuses the exact same shape as ISSUE_STATUS: a Record<state, token> plus
// a resolver. It just carries a colour too (up/down are semantic), and has no
// severity ordering. The abstraction held without touching the Issue tokens.

export type MonitorState = "up" | "down" | "none";

export interface MonitorStatusToken {
  /** Accent colour (semantic: up = success, down = error). */
  readonly color: string;
  readonly icon: string;
  readonly label: string;
}

export const MONITOR_STATUS: Record<MonitorState, MonitorStatusToken> = {
  up: { color: "var(--success-color)", icon: "check_circle", label: "Up" },
  down: { color: "var(--mat-sys-error)", icon: "error", label: "Down" },
  none: { color: "var(--mat-sys-outline)", icon: "help", label: "No data" },
};

/** Map the raw `isUp` tri-state boolean to its named identity state. */
export function monitorState(isUp: boolean | null | undefined): MonitorState {
  return isUp === true ? "up" : isUp === false ? "down" : "none";
}

/** Resolve a monitor's (or check's) `isUp` to its identity token. */
export function monitorStatusToken(
  isUp: boolean | null | undefined,
): MonitorStatusToken {
  return MONITOR_STATUS[monitorState(isUp)];
}

// --- Issue name derivation --------------------------------------------------

/** The minimal structural shape needed to derive an Issue's name. Both the
 *  hand-written list `Issue` and the generated `IssueDetailSchema` satisfy it
 *  (the schema types metadata values as `unknown`, so we coerce below). */
export interface IssueNameInput {
  type?: string | null;
  metadata?: { [key: string]: unknown } | null;
  culprit?: string | null;
  title?: string | null;
}

/** Read a metadata field as a string, ignoring non-string values. */
function metaStr(
  metadata: { [key: string]: unknown },
  key: string,
): string | undefined {
  const value = metadata[key];
  return typeof value === "string" ? value : undefined;
}

export interface IssueName {
  /** Primary name — what the issue *is*. */
  title: string;
  /** Secondary identifier shown alongside (culprit / uri / origin). */
  suffix: string | null;
  /** Supporting "what happened" line. */
  subtitle: string;
}

/**
 * Derive an Issue's display name from its metadata + type. Previously this lived
 * only in the masthead; centralising it means the list row, masthead, and any
 * nested reference all name the same issue identically.
 */
export function issueName(issue: IssueNameInput): IssueName {
  const metadata = issue.metadata ?? {};
  const culprit = issue.culprit ?? null;
  const fallback = issue.title || "";

  let title: string;
  let suffix: string | null;
  let subtitle: string;

  switch (issue.type) {
    case "error":
      title = metaStr(metadata, "type") || metaStr(metadata, "function") || fallback;
      suffix = culprit;
      subtitle = metaStr(metadata, "value") ?? "";
      break;
    case "csp":
      title = metaStr(metadata, "directive") || fallback;
      suffix = metaStr(metadata, "uri") || null;
      subtitle = metaStr(metadata, "message") ?? "";
      break;
    case "default":
      title = metaStr(metadata, "message") || fallback;
      suffix = metaStr(metadata, "origin") || null;
      subtitle = "";
      break;
    default:
      title = metaStr(metadata, "title") || fallback;
      suffix = null;
      subtitle = culprit ?? "";
  }

  return { title, suffix, subtitle };
}

// --- Aggregate glance -------------------------------------------------------

/**
 * The dominant (most severe) level across a collection of issues — for the
 * dashboard's aggregate "glance" so a summary card can wear the identity of the
 * worst thing it represents. Returns null for an empty collection.
 */
export function dominantIssueLevel(
  levels: Array<string | null | undefined>,
): IssueLevel | null {
  let winner: IssueLevel | null = null;
  let best = -1;
  for (const raw of levels) {
    const level = (raw ?? "error") as IssueLevel;
    const token = ISSUE_LEVEL[level];
    if (token && token.severity > best) {
      best = token.severity;
      winner = level;
    }
  }
  return winner;
}
