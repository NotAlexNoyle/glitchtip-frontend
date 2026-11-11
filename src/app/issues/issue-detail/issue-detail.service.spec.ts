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
    // The page keeps the issue it showed while the fresh copy loads.
    expect(service.issue()).toMatchObject({ id: "7" });
    await settle();
    expect(get.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        "/api/0/issues/{issue_id}/",
        "/api/0/issues/{issue_id}/events/latest/",
        "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/tags/",
      ]),
    );
  });
});
