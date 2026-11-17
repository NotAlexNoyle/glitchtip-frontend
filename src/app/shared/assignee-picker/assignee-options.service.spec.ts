import type {} from "@angular/localize/init";
import { describe, expect, it, vi } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { OrganizationsService } from "src/app/api/organizations.service";
import { OrganizationDetailService } from "src/app/api/organizations/organization-detail.service";
import { TeamsService } from "src/app/api/teams/teams.service";
import { UserService } from "src/app/api/user/user.service";
import {
  AssigneeOptionsService,
  assigneeLabel,
  isCurrentAssignee,
} from "./assignee-options.service";

const member = (id: string, email: string, name = "", pending = false) => ({
  id,
  email,
  pending,
  user: pending ? null : { id, email, name },
});

const setMembersOrgSlug = vi.fn();
const slug = signal("acme");

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: OrganizationsService,
        useValue: { activeOrganizationSlug: slug },
      },
      {
        provide: OrganizationDetailService,
        useValue: {
          organizationMembers: signal([
            member("1", "zed@acme.test", "Zed"),
            member("2", "ana@acme.test", "Ana"),
            member("3", "me@acme.test"),
            member("4", "invite@acme.test", "", true),
          ]),
          organizationMembersResource: { isLoading: () => false },
          setMembersOrgSlug,
        },
      },
      {
        provide: TeamsService,
        useValue: {
          teams: signal([{ id: "9", slug: "platform" }]),
          teamsResource: { isLoading: () => false },
          setTeamsOrgSlug: () => undefined,
        },
      },
      { provide: UserService, useValue: { user: signal({ id: "3" }) } },
    ],
  });
  return TestBed.inject(AssigneeOptionsService);
}

describe("AssigneeOptionsService", () => {
  it("leaves out pending invites, which the backend can't assign", () => {
    const emails = setup()
      .members()
      .map((m) => m.actor.email);
    expect(emails).not.toContain("invite@acme.test");
  });

  it("lists me first, then the rest by name", () => {
    const options = setup().members();
    expect(options.map((m) => m.actor.name)).toEqual([
      "me@acme.test",
      "Ana",
      "Zed",
    ]);
    expect(options[0].isMe).toBe(true);
  });

  it("loads the active org's people again after an org switch", () => {
    setup();
    TestBed.tick();
    slug.set("other");
    TestBed.tick();
    expect(setMembersOrgSlug).toHaveBeenLastCalledWith("other");
    slug.set("acme");
  });

  it("uses the backend's assignedTo formats", () => {
    const service = setup();
    expect(service.members()[1].value).toBe("user:2");
    expect(service.teams()[0].value).toBe("team:platform");
  });
});

describe("isCurrentAssignee", () => {
  const ana = {
    value: "user:2",
    isMe: false,
    actor: { type: "user" as const, id: "2", name: "Ana" },
  };

  it("matches a user by id and a team by slug", () => {
    expect(isCurrentAssignee(ana, { type: "user", id: "2", name: "Ana" })).toBe(
      true,
    );
    const team = {
      value: "team:platform",
      isMe: false,
      actor: {
        type: "team" as const,
        id: "9",
        name: "platform",
        slug: "platform",
      },
    };
    expect(
      isCurrentAssignee(team, {
        type: "team",
        id: "9",
        name: "platform",
        slug: "platform",
      }),
    ).toBe(true);
  });

  it("never matches a team with the same id as a user", () => {
    expect(isCurrentAssignee(ana, { type: "team", id: "2", name: "x" })).toBe(
      false,
    );
    expect(isCurrentAssignee(ana, null)).toBe(false);
  });
});

describe("assigneeLabel", () => {
  it("prefixes teams with # and shows people by name", () => {
    expect(assigneeLabel({ type: "team", id: "9", name: "platform" })).toBe(
      "#platform",
    );
    expect(assigneeLabel({ type: "user", id: "2", name: "Ana" })).toBe("Ana");
  });
});
