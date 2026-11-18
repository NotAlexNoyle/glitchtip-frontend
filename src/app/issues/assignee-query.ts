import { IssueActor } from "./interfaces";
import { termValue, withTerm } from "./search-terms";

/** Search key for the assignee filter: me, my_teams, none, #team or an email. */
const ASSIGNED_KEY = "assigned";

/** The assigned: value in a search query, or null when there is none. */
export const assignedFilter = (query: string | null | undefined) =>
  termValue(query, ASSIGNED_KEY);

/** The query with its assigned: term replaced, or removed when value is null. */
export const withAssignedFilter = (
  query: string | null | undefined,
  value: string | null,
) => withTerm(query, ASSIGNED_KEY, value);

/** The assigned: value that matches an assignee: #slug for a team, email for a person. */
export function assignedValueFor(actor: IssueActor): string {
  return actor.type === "team"
    ? `#${actor.slug ?? actor.name}`
    : (actor.email ?? actor.id);
}
