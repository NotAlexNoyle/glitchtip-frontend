import { IssueStatus } from "./interfaces";

/** How an issue status reads and its dot colour, for gt-status-pill on the issue page and in the list. */
export const ISSUE_STATUS: Record<
  IssueStatus,
  { label: string; color: string }
> = {
  unresolved: { label: $localize`Unresolved`, color: "var(--info-color)" },
  resolved: { label: $localize`Resolved`, color: "var(--success-color)" },
  ignored: { label: $localize`Ignored`, color: "var(--mat-sys-outline)" },
};
