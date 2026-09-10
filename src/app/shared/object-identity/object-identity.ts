/**
 * Single source of truth for how a domain object presents itself: its icon, and
 * how an Issue's level and status map to visual tokens. Surfaces read from here
 * rather than each re-deciding, so an issue looks the same in a list row as on
 * its detail page.
 */

import { components } from "src/app/api/api-schema";

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
 * Material glyph per object type. The app ships a subset Material Symbols font,
 * so these reuse icons the product already loads (see the main nav); anything
 * outside the subset renders as literal ligature text.
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

export type IssueLevel = components["schemas"]["LogLevelDisplay"];

export interface LevelToken {
  readonly color: string;
  /** Human label; drives accessible names so level is never colour-only. */
  readonly label: string;
  /** Ordering for "most severe wins" when summarising a collection. */
  readonly severity: number;
  /** Fatal reads as a striped bar: the one genuinely exceptional treatment. */
  readonly striped: boolean;
}

export const ISSUE_LEVEL: Record<IssueLevel, LevelToken> = {
  sample: {
    color: "var(--mat-sys-outline)",
    label: $localize`Sample`,
    severity: 0,
    striped: false,
  },
  debug: {
    color: "var(--mat-sys-outline-variant)",
    label: $localize`Debug`,
    severity: 1,
    striped: false,
  },
  info: {
    color: "var(--info-color)",
    label: $localize`Info`,
    severity: 2,
    striped: false,
  },
  warning: {
    color: "var(--warning-color)",
    label: $localize`Warning`,
    severity: 3,
    striped: false,
  },
  error: {
    color: "var(--mat-sys-error)",
    label: $localize`Error`,
    severity: 4,
    striped: false,
  },
  fatal: {
    color: "var(--mat-sys-error)",
    label: $localize`Fatal`,
    severity: 5,
    striped: true,
  },
};

/** Levels arrive untyped from the API; fall back rather than render nothing. */
export function issueLevelToken(level: string | null | undefined): LevelToken {
  return ISSUE_LEVEL[(level ?? "error") as IssueLevel] ?? ISSUE_LEVEL.error;
}

// --- Issue status identity --------------------------------------------------

export type IssueStatus = components["schemas"]["EventStatusDisplay"];

export interface StatusToken {
  readonly icon: string;
  readonly label: string;
}

export const ISSUE_STATUS: Record<IssueStatus, StatusToken> = {
  unresolved: { icon: "priority_high", label: $localize`Unresolved` },
  resolved: { icon: "done", label: $localize`Resolved` },
  ignored: { icon: "notifications_off", label: $localize`Ignored` },
};

export function issueStatusToken(
  status: string | null | undefined,
): StatusToken {
  return (
    ISSUE_STATUS[(status ?? "unresolved") as IssueStatus] ??
    ISSUE_STATUS.unresolved
  );
}
