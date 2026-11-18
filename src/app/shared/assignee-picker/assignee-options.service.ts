import { Injectable, computed, inject } from "@angular/core";
import { OrganizationsService } from "src/app/api/organizations.service";
import { UserService } from "src/app/api/user/user.service";
import { IssueActor } from "src/app/issues/interfaces";
import { apiResource } from "src/app/shared/api/api-resource-factory";

/** One row in the assignee picker. `value` is the backend's assignedTo string. */
export interface AssigneeOption {
  value: string;
  actor: IssueActor;
  isMe: boolean;
}

/** Every member and team of the active org that an issue can be assigned to. */
@Injectable({ providedIn: "root" })
export class AssigneeOptionsService {
  private organizationsService = inject(OrganizationsService);
  private userService = inject(UserService);

  // Every page, not the first 50: a picker that drops people can't be trusted.
  #members = apiResource.fetchAll(
    this.organizationsService.activeOrganizationSlug,
    (slug) => ({
      url: "/api/0/organizations/{organization_id_or_slug}/members/",
      options: { params: { path: this.organizationsService.orgPath(slug) } },
    }),
  );
  #teams = apiResource.fetchAll(
    this.organizationsService.activeOrganizationSlug,
    (slug) => ({
      url: "/api/0/organizations/{organization_id_or_slug}/teams/",
      options: { params: { path: this.organizationsService.orgPath(slug) } },
    }),
  );

  readonly members = computed<AssigneeOption[]>(() => {
    const meId = this.userService.user()?.id;
    const members = this.#members.hasValue()
      ? (this.#members.value() ?? [])
      : [];
    return (
      members
        // Pending invites have no user yet, so the backend rejects them.
        .filter((member) => !member.pending && member.user)
        .map((member) => {
          const user = member.user!;
          return {
            value: `user:${user.id}`,
            isMe: user.id === meId,
            actor: {
              type: "user" as const,
              id: user.id,
              name: user.name || user.email,
              email: user.email,
              username: user.email,
            },
          };
        })
        .sort((a, b) =>
          a.isMe ? -1 : b.isMe ? 1 : a.actor.name.localeCompare(b.actor.name),
        )
    );
  });

  readonly teams = computed<AssigneeOption[]>(() =>
    [...(this.#teams.hasValue() ? (this.#teams.value() ?? []) : [])]
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map((team) => ({
        value: `team:${team.slug}`,
        isMe: false,
        actor: {
          type: "team" as const,
          id: team.id,
          name: team.slug,
          slug: team.slug,
        },
      })),
  );

  readonly me = computed(() => this.members().find((m) => m.isMe) ?? null);

  readonly loading = computed(
    () => this.#members.isLoading() || this.#teams.isLoading(),
  );
}

/** Most rows a picker shows; past this, typing narrows the list. */
export const ASSIGNEE_ROW_LIMIT = 50;

/** What a picker renders: teams, then members, capped, with the full count. */
export interface AssigneeList {
  teams: AssigneeOption[];
  members: AssigneeOption[];
  shown: number;
  total: number;
}

/** Whether an option matches typed text, by name, email or team slug. */
export function matchesAssignee(
  option: AssigneeOption,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { name, email, slug } = option.actor;
  return [name, email, slug].some((s) => s?.toLowerCase().includes(q));
}

/**
 * The rows every assignee picker shows: teams before members (fewer, and the
 * usual triage target), the current one first in its group, at most `limit`.
 */
export function assigneeList(
  teams: AssigneeOption[],
  members: AssigneeOption[],
  query: string,
  isCurrent: (option: AssigneeOption) => boolean,
  limit = ASSIGNEE_ROW_LIMIT,
): AssigneeList {
  const order = (options: AssigneeOption[]) => {
    const matching = options.filter((o) => matchesAssignee(o, query));
    return [
      ...matching.filter(isCurrent),
      ...matching.filter((o) => !isCurrent(o)),
    ];
  };
  const allTeams = order(teams);
  const allMembers = order(members);
  const shownTeams = allTeams.slice(0, limit);
  const shownMembers = allMembers.slice(0, limit - shownTeams.length);
  return {
    teams: shownTeams,
    members: shownMembers,
    shown: shownTeams.length + shownMembers.length,
    total: allTeams.length + allMembers.length,
  };
}

/** Whether an option is the issue's current assignee. */
export function isCurrentAssignee(
  option: AssigneeOption,
  current: IssueActor | null | undefined,
): boolean {
  if (!current || current.type !== option.actor.type) return false;
  return current.type === "team"
    ? current.slug === option.actor.slug
    : current.id === option.actor.id;
}

/** Two initials: "Ben Silva" is BS, "ana.ruiz@x.com" is AR, team "zz-regressions" is ZR. */
export function assigneeInitials(actor: IssueActor): string {
  const name = actor.type === "team" ? (actor.slug ?? actor.name) : actor.name;
  const source = name.includes("@") ? name.split("@")[0] : name;
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "").slice(0, 2);
  return letters.toUpperCase();
}

/** "#backend" for a team, the person's name otherwise. */
export function assigneeLabel(actor: IssueActor): string {
  return actor.type === "team" ? `#${actor.name}` : actor.name;
}
