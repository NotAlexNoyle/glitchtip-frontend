import { Injectable, computed, effect, inject } from "@angular/core";
import { OrganizationsService } from "src/app/api/organizations.service";
import { OrganizationDetailService } from "src/app/api/organizations/organization-detail.service";
import { TeamsService } from "src/app/api/teams/teams.service";
import { UserService } from "src/app/api/user/user.service";
import { IssueActor } from "src/app/issues/interfaces";

/** One row in the assignee picker. `value` is the backend's assignedTo string. */
export interface AssigneeOption {
  value: string;
  actor: IssueActor;
  isMe: boolean;
}

/** Org members and teams an issue can be assigned to, for the active org. */
@Injectable({ providedIn: "root" })
export class AssigneeOptionsService {
  private organizationsService = inject(OrganizationsService);
  private organizationDetailService = inject(OrganizationDetailService);
  private teamsService = inject(TeamsService);
  private userService = inject(UserService);

  readonly members = computed<AssigneeOption[]>(() => {
    const meId = this.userService.user()?.id;
    return (
      this.organizationDetailService
        .organizationMembers()
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
    [...(this.teamsService.teams() ?? [])]
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
    () =>
      this.organizationDetailService.organizationMembersResource.isLoading() ||
      this.teamsService.teamsResource.isLoading(),
  );

  constructor() {
    // Follow the active org, so a switch never offers the previous org's people.
    effect(() => {
      const slug = this.organizationsService.activeOrganizationSlug();
      if (!slug) return;
      this.organizationDetailService.setMembersOrgSlug(slug);
      this.teamsService.setTeamsOrgSlug(slug);
    });
  }
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

/** "#backend" for a team, the person's name otherwise. */
export function assigneeLabel(actor: IssueActor): string {
  return actor.type === "team" ? `#${actor.name}` : actor.name;
}
