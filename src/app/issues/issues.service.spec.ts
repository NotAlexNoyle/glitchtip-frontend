// Type-only: declares the $localize global for the spec program. The runtime
// polyfill is already loaded by the test builder.
import type {} from "@angular/localize/init";
import { afterEach, describe, expect, it, vi } from "vitest";
import { effect, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { client } from "src/app/shared/api/api";
import { OrganizationsService } from "src/app/api/organizations.service";
import { IssuesService } from "./issues.service";

function setup() {
  vi.spyOn(client, "GET").mockResolvedValue({
    data: [],
    response: new Response(null, { status: 200 }),
  } as never);
  vi.spyOn(client, "PUT").mockResolvedValue({ data: {} } as never);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      IssuesService,
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
  return TestBed.inject(IssuesService);
}

const params = (query: string, cursor?: string) => ({
  orgSlug: "acme",
  query,
  cursor,
  project: ["1"],
});

describe("IssuesService selection", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it("clears when the search or page changes, so actions can't reach unseen issues", () => {
    const service = setup();
    service.updateParams(params("is:unresolved"));
    service.toggleSelectOne("7");
    service.selectAllResults();
    expect(service.allResultsSelected()).toBe(true);

    service.updateParams(params("is:resolved"));
    expect(service.selectedIssues()).toEqual([]);
    expect(service.allResultsSelected()).toBe(false);

    service.toggleSelectOne("8");
    service.updateParams(params("is:resolved", "next-page"));
    expect(service.selectedIssues()).toEqual([]);
  });

  it("keeps the selection when the same list is applied again", () => {
    const service = setup();
    service.updateParams(params("is:unresolved"));
    service.toggleSelectOne("7");
    service.updateParams(params("is:unresolved"));
    expect(service.selectedIssues()).toEqual(["7"]);
  });

  it("can be fed from an effect, as the page does, without looping", () => {
    const service = setup();
    const query = signal("is:unresolved");
    TestBed.runInInjectionContext(() =>
      effect(() => service.updateParams(params(query()))),
    );
    TestBed.tick();
    service.toggleSelectOne("7");
    TestBed.tick();
    expect(service.selectedIssues()).toEqual(["7"]);
    query.set("is:resolved");
    TestBed.tick();
    expect(service.selectedIssues()).toEqual([]);
  });

  it("clears after a merge", async () => {
    const service = setup();
    service.updateParams(params("is:unresolved"));
    service.toggleSelectOne("7");
    service.toggleSelectOne("8");
    await service.mergeIssues("acme", ["7", "8"]);
    expect(service.selectedIssues()).toEqual([]);
  });

  it("keeps the selection when a merge fails, so it can be retried", async () => {
    const service = setup();
    service.updateParams(params("is:unresolved"));
    service.toggleSelectOne("7");
    service.toggleSelectOne("8");
    vi.mocked(client.PUT).mockResolvedValue({
      error: { detail: "no" },
    } as never);
    await service.mergeIssues("acme", ["7", "8"]);
    expect(service.selectedIssues()).toEqual(["7", "8"]);
  });
});
