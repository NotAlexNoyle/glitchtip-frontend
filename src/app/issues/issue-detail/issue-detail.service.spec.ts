import type {} from "@angular/localize/init";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { IssueDetailService } from "./issue-detail.service";
import { OrganizationsService } from "src/app/api/organizations.service";
import { client } from "src/app/shared/api/api";

describe("IssueDetailService prev/next event links", () => {
  let service: IssueDetailService;

  beforeEach(() => {
    vi.spyOn(client, "GET").mockImplementation((async (url: string) => {
      const data = url.endsWith("/events/latest/")
        ? {
            eventID: "cur",
            nextEventID: "next1",
            previousEventID: "prev1",
            entries: [],
            contexts: {},
            tags: [],
          }
        : { id: "7", title: "boom", project: { slug: "p" } };
      return { data, error: undefined, response: new Response(null) };
    }) as any);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        {
          provide: OrganizationsService,
          useValue: {
            // The org switcher has already moved on; the route has not.
            activeOrganizationSlug: signal("org-b"),
            orgPath: (slug: string) => ({ organization_id_or_slug: slug }),
          },
        },
      ],
    });
    service = TestBed.inject(IssueDetailService);
  });

  it("build links on the issue's org, not the active org", async () => {
    service.orgSlug.set("org-a");
    service.issueID.set("7");
    await vi.waitFor(() => expect(service.event()).toBeTruthy());
    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.nextEventUrl()).toBe("/org-a/issues/7/events/next1");
    expect(service.previousEventUrl()).toBe("/org-a/issues/7/events/prev1");
  });
});
