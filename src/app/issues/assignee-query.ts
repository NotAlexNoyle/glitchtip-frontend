import { IssueActor } from "./interfaces";

/** Search key for the assignee filter: me, my_teams, none, #team or an email. */
const ASSIGNED_KEY = "assigned";

const isAssignedToken = (token: string) => token.startsWith(`${ASSIGNED_KEY}:`);

/** The assigned: value in a search query, or null when there is none. */
export function assignedFilter(
  query: string | null | undefined,
): string | null {
  const token = (query ?? "").split(/\s+/).find(isAssignedToken);
  return token ? token.slice(ASSIGNED_KEY.length + 1) || null : null;
}

/** The query with its assigned: term replaced, or removed when value is null. */
export function withAssignedFilter(
  query: string | null | undefined,
  value: string | null,
): string {
  const tokens = (query ?? "").split(/\s+/).filter(Boolean);
  const kept = tokens.filter((t) => !isAssignedToken(t));
  if (!value) return kept.join(" ");
  // Structured terms go before bare words; the backend stops at the first word.
  const firstWord = kept.findIndex((t) => !t.includes(":"));
  const at = firstWord < 0 ? kept.length : firstWord;
  kept.splice(at, 0, `${ASSIGNED_KEY}:${value}`);
  return kept.join(" ");
}

/** The assigned: value that matches an assignee: #slug for a team, email for a person. */
export function assignedValueFor(actor: IssueActor): string {
  return actor.type === "team"
    ? `#${actor.slug ?? actor.name}`
    : (actor.email ?? actor.id);
}
