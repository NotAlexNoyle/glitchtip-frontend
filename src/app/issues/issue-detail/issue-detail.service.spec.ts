import type {} from "@angular/localize/init";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { OrganizationsService } from "src/app/api/organizations.service";
import { client } from "src/app/shared/api/api";
import {
  holdWhileLoading,
  IssueDetailService,
  LoadedEvent,
} from "./issue-detail.service";

const loaded = (
  value: string | null | undefined,
  loading = false,
  issueID = "1",
  visit = 1,
): LoadedEvent<string> => ({ value, loading, issueID, visit });

describe("holdWhileLoading", () => {
  it("keeps the shown event while the next one of the same issue loads", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(holdWhileLoading(loaded(undefined, true), prev)).toBe("a");
  });

  it("shows the next event once it has loaded", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(holdWhileLoading(loaded("b"), prev)).toBe("b");
  });

  it("does not carry an event over to another issue", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(
      holdWhileLoading(loaded(undefined, true, "2"), prev),
    ).toBeUndefined();
  });

  it("does not carry an event over to a new visit of the same issue", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(
      holdWhileLoading(loaded(undefined, true, "1", 2), prev),
    ).toBeUndefined();
  });

  it("shows not found (null) rather than the previous event", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(holdWhileLoading(loaded(null), prev)).toBeNull();
  });
});

describe("IssueDetailService open", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fetches the issue, its tags and its event again on coming back", async () => {
    const get = vi.spyOn(client, "GET").mockImplementation((async (
      url: string,
    ) => ({
      data: url.endsWith("/tags/") ? [] : { id: "7", entries: [] },
      error: undefined,
      response: new Response(null),
    })) as never);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        {
          provide: OrganizationsService,
          useValue: {
            activeOrganizationSlug: signal("acme"),
            orgPath: (slug: string) => ({ organization_id_or_slug: slug }),
          },
        },
      ],
    });
    const service = TestBed.inject(IssueDetailService);
    const settle = () => TestBed.inject(ApplicationRef).whenStable();
    service.open("acme", "7");
    await settle();
    get.mockClear();

    service.open("acme", "7");
    // The issue stays while it reloads; the event, which may be stale, does not.
    expect(service.issue()).toMatchObject({ id: "7" });
    expect(service.event()).toBeUndefined();
    await settle();
    const urls = get.mock.calls.map((call) => String(call[0]));
    expect(urls.filter((url) => url.includes("/events/"))).toHaveLength(1);
    expect(urls).toEqual(
      expect.arrayContaining([
        "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/",
        "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/events/latest/",
        "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/tags/",
      ]),
    );
  });
});

// Assignment (from !876).
const ana = { type: "user" as const, id: "2", name: "Ana" };
const platform = {
  type: "team" as const,
  id: "9",
  name: "platform",
  slug: "platform",
};

async function loadIssue(put: unknown) {
  vi.spyOn(client, "GET").mockResolvedValue({
    data: { id: "1", assignedTo: ana },
    response: new Response(null, { status: 200 }),
  } as never);
  const putSpy = vi.spyOn(client, "PUT").mockResolvedValue(put as never);
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: MatSnackBar, useValue: snackBar },
      {
        provide: OrganizationsService,
        useValue: {
          activeOrganizationSlug: signal("acme"),
          orgPath: (slug: string) => ({ organization_id_or_slug: slug }),
        },
      },
    ],
  });
  const service = TestBed.inject(IssueDetailService);
  service.open("acme", "1");
  await TestBed.inject(ApplicationRef).whenStable();
  return { service, putSpy, snackBar };
}

describe("IssueDetailService.setAssignee", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it("sends the picked value and keeps the saved assignee", async () => {
    const { service, putSpy } = await loadIssue({
      data: { assignedTo: platform },
    });
    await service.setAssignee({ value: "team:platform", actor: platform });
    expect(putSpy.mock.calls[0][1]).toMatchObject({
      body: { assignedTo: "team:platform" },
    });
    expect(service.issue()?.assignedTo).toEqual(platform);
  });

  it("ignores a reply that arrives after moving to another issue", async () => {
    let reply!: (value: unknown) => void;
    const { service } = await loadIssue(undefined);
    vi.mocked(client.PUT).mockReturnValue(
      new Promise((resolve) => (reply = resolve)) as never,
    );
    const pending = service.setAssignee({
      value: "team:platform",
      actor: platform,
    });
    service.open("acme", "2");
    await TestBed.inject(ApplicationRef).whenStable();
    reply({ data: { assignedTo: platform } });
    await pending;
    expect(service.issue()?.assignedTo).toEqual(ana);
  });

  it("puts the previous assignee back when the backend refuses", async () => {
    const { service, snackBar } = await loadIssue({
      error: { detail: "Team not found" },
    });
    await service.setAssignee({ value: "team:platform", actor: platform });
    expect(service.issue()?.assignedTo).toEqual(ana);
    expect(snackBar.open).toHaveBeenCalled();
  });
});
