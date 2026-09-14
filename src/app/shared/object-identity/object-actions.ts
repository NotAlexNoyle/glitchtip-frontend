/**
 * Object actions — the single source of truth for an object's CTAs: which verbs
 * it has, how they present, and which is the likely-next one. The behavioural
 * counterpart to object-identity.ts.
 *
 * Just as identity answers "what does this object look like", the action catalog
 * answers "what can I do to this object" — read by every surface so the verbs
 * are the same, in the same order, wherever the object appears. This layer only
 * describes and orders the actions; the host wires each id to the existing
 * service handler (the real mutation stays where it already lives).
 *
 * Icons are subset-safe (see the font trap in this doc's identity section) and,
 * where an action mirrors a status, reuse the same glyph as ISSUE_STATUS so the
 * verb and the state read as the same thing.
 */

export interface ObjectActionItem {
  readonly id: string;
  readonly label: string;
  /** Subset-safe Material Symbols glyph. */
  readonly icon: string;
  readonly kind: "primary" | "default" | "destructive";
}

export interface ObjectActionSet {
  /** The likely-next action, surfaced as a button on roomy surfaces. */
  readonly primary: ObjectActionItem | null;
  /** The remaining actions, shown in the overflow menu (same order everywhere). */
  readonly more: ObjectActionItem[];
}

// --- Issue action catalog ---------------------------------------------------

const RESOLVE: ObjectActionItem = {
  id: "resolve",
  label: "Resolve",
  icon: "done",
  kind: "primary",
};
const REOPEN: ObjectActionItem = {
  id: "unresolve",
  label: "Reopen",
  icon: "priority_high",
  kind: "default",
};
const IGNORE: ObjectActionItem = {
  id: "ignore",
  label: "Ignore",
  icon: "notifications_off",
  kind: "default",
};
const RESOLVE_NEXT_RELEASE: ObjectActionItem = {
  id: "resolveNextRelease",
  label: "Resolve in next release",
  icon: "rocket_launch",
  kind: "default",
};
const DELETE: ObjectActionItem = {
  id: "delete",
  label: "Delete",
  icon: "delete",
  kind: "destructive",
};

/**
 * The Issue's canonical actions for a given status. The primary is the verb a
 * user most likely wants next; the current status itself is shown by the
 * masthead's status indicator, so the bar is free to be purely action-oriented.
 */
export function issueActions(status: string | null | undefined): ObjectActionSet {
  switch (status) {
    case "resolved":
      return { primary: { ...REOPEN, kind: "primary" }, more: [IGNORE, DELETE] };
    case "ignored":
      return {
        primary: RESOLVE,
        more: [{ ...REOPEN, label: "Unignore" }, RESOLVE_NEXT_RELEASE, DELETE],
      };
    default: // unresolved
      return { primary: RESOLVE, more: [IGNORE, RESOLVE_NEXT_RELEASE, DELETE] };
  }
}
