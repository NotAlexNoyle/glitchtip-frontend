import type {} from "@angular/localize/init";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { client } from "src/app/shared/api/api";
import { OrganizationsService } from "src/app/api/organizations.service";
import { UserService } from "src/app/api/user/user.service";
import {
  AssigneeOption,
  AssigneeOptionsService,
  assigneeInitials,
  assigneeLabel,
  assigneeList,
  isCurrentAssignee,
} from "./assignee-options.service";

const member = (id: string, email: string, name = "", pending = false) => ({
  id,
  email,
  pending,
  user: pending ? null : { id, email, name },
});

// The backend's pagination headers; "next" has results="true" while more remain.
const page = (data: unknown[], next?: string) => ({
  data,
  response: new Response(null, {
    status: 200,
    headers: {
      "x-hits": String(data.length),
      "x-max-hits": "1000",
      link: [
        '<http://test/>; rel="previous"; results="false"',
        `<http://test/?cursor=${next ?? ""}>; rel="next"; results="${next ? "true" : "false"}"; cursor="${next ?? ""}"`,
      ].join(", "),
    },
  }),
});

async function setup(members: unknown[][], teams: unknown[] = [], load = true) {
  const slug = signal("acme");
  const get = vi.spyOn(client, "GET").mockImplementation(((
    url: string,
    init: { params: { query: { cursor?: string } } },
  ) => {
    if (url.endsWith("/teams/")) return Promise.resolve(page(teams));
    const i = Number(init.params.query.cursor ?? 0);
    return Promise.resolve(
      page(members[i], i + 1 < members.length ? String(i + 1) : undefined),
    );
  }) as never);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: OrganizationsService,
        useValue: {
          activeOrganizationSlug: slug,
          orgPath: (s: string) => ({ organization_id_or_slug: s }),
        },
      },
      { provide: UserService, useValue: { user: signal({ id: "3" }) } },
    ],
  });
  const service = TestBed.inject(AssigneeOptionsService);
  if (load) service.load();
  await TestBed.inject(ApplicationRef).whenStable();
  return { service, get, slug };
}

describe("AssigneeOptionsService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it("fetches nothing until a picker asks, and counts as loading until then", async () => {
    const { service, get } = await setup(
      [[member("1", "a@acme.test")]],
      [],
      false,
    );
    expect(get).not.toHaveBeenCalled();
    expect(service.loading()).toBe(true);
    service.load();
    await TestBed.inject(ApplicationRef).whenStable();
    expect(get).toHaveBeenCalled();
    expect(service.loading()).toBe(false);
  });

  it("follows every page of members, not just the first", async () => {
    const { service } = await setup([
      [member("1", "a@acme.test", "A")],
      [member("2", "b@acme.test", "B")],
    ]);
    expect(service.members().map((m) => m.actor.name)).toEqual(["A", "B"]);
  });

  it("leaves out pending invites and lists me first", async () => {
    const { service } = await setup([
      [
        member("1", "zed@acme.test", "Zed"),
        member("3", "me@acme.test"),
        member("4", "invite@acme.test", "", true),
      ],
    ]);
    expect(service.members().map((m) => m.actor.name)).toEqual([
      "me@acme.test",
      "Zed",
    ]);
  });

  it("uses the backend's assignedTo formats and sorts teams", async () => {
    const { service } = await setup(
      [[member("2", "ana@acme.test", "Ana")]],
      [
        { id: "8", slug: "web" },
        { id: "9", slug: "api" },
      ],
    );
    expect(service.members()[0].value).toBe("user:2");
    expect(service.teams().map((t) => t.value)).toEqual([
      "team:api",
      "team:web",
    ]);
  });

  it("loads the new org's people after an org switch", async () => {
    const { get, slug } = await setup([[member("1", "a@acme.test")]]);
    slug.set("other");
    await TestBed.inject(ApplicationRef).whenStable();
    expect(get).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.objectContaining({
          path: { organization_id_or_slug: "other" },
        }),
      }),
    );
  });
});

const person = (id: string, name: string) =>
  ({
    value: `user:${id}`,
    isMe: false,
    actor: { type: "user", id, name, email: `${name.toLowerCase()}@acme.test` },
  }) as AssigneeOption;
const team = (slug: string) =>
  ({
    value: `team:${slug}`,
    isMe: false,
    actor: { type: "team", id: slug, name: slug, slug },
  }) as AssigneeOption;

describe("assigneeList", () => {
  const none = () => false;

  it("puts teams before members and the current one first", () => {
    const list = assigneeList(
      [team("api")],
      [person("1", "Ana"), person("2", "Zoe")],
      "",
      (o) => o.value === "user:2",
    );
    expect(list.teams.map((o) => o.value)).toEqual(["team:api"]);
    expect(list.members.map((o) => o.actor.name)).toEqual(["Zoe", "Ana"]);
  });

  it("caps the rows and reports the full count", () => {
    const people = Array.from({ length: 60 }, (_, i) =>
      person(`${i}`, `P${i}`),
    );
    const list = assigneeList([team("api")], people, "", none);
    expect(list.shown).toBe(50);
    expect(list.total).toBe(61);
    expect(list.teams.length).toBe(1);
  });

  it("matches name, email and slug", () => {
    const list = assigneeList(
      [team("platform")],
      [person("1", "Ana")],
      "ana@",
      none,
    );
    expect(list.total).toBe(1);
    expect(assigneeList([team("platform")], [], "PLAT", none).total).toBe(1);
  });
});

describe("isCurrentAssignee", () => {
  const ana = person("2", "Ana");

  it("matches a user by id and a team by slug", () => {
    expect(isCurrentAssignee(ana, { type: "user", id: "2", name: "Ana" })).toBe(
      true,
    );
    expect(
      isCurrentAssignee(team("platform"), {
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

describe("assigneeInitials", () => {
  const user = (name: string) => ({ type: "user" as const, id: "1", name });

  it("takes the first letters of two words, or of an email's name part", () => {
    expect(assigneeInitials(user("Ben Silva"))).toBe("BS");
    expect(assigneeInitials(user("ana.ruiz@acme.test"))).toBe("AR");
    expect(assigneeInitials(user("cher"))).toBe("CH");
  });

  it("uses a team's slug", () => {
    const team = (slug: string) => ({
      type: "team" as const,
      id: "9",
      name: slug,
      slug,
    });
    expect(assigneeInitials(team("platform"))).toBe("PL");
    expect(assigneeInitials(team("zz-regressions"))).toBe("ZR");
  });
});
