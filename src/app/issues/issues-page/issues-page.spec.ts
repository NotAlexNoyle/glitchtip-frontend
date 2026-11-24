// Type-only: declares the $localize global for the spec program. The runtime
// polyfill is already loaded by the test builder.
import type {} from "@angular/localize/init";
import { describe, expect, it, vi } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { of } from "rxjs";
import { IssuesPage } from "./issues-page";
import { IssuesService } from "../issues.service";
import { EnvironmentsService } from "src/app/api/environments.service";
import { OrganizationsService } from "src/app/api/organizations.service";
import { SettingsService } from "src/app/api/settings.service";

function setup(query?: string) {
  const issues = {
    paginator: signal(undefined),
    loading: signal(false),
    initialLoad: signal(false),
    initialLoadComplete: signal(true),
    issuesWithSelected: signal([]),
    areAllSelected: signal(false),
    statsPeriod: signal("24h"),
    statsChartDataFrame: signal(undefined),
    issueStatsLoading: signal(false),
    thereAreSelectedIssues: signal(true),
    allResultsSelected: signal(true),
    numberOfSelectedIssues: signal(25),
    updateParams: vi.fn(),
    bulkUpdateStatus: vi.fn(),
    bulkDeleteIssues: vi.fn(),
    assign: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: EnvironmentsService,
        useValue: {
          environmentNames: signal([]),
          projectSlug: signal(null),
          hasValue: () => false,
          reload: vi.fn(),
        },
      },
      {
        provide: OrganizationsService,
        useValue: {
          activeOrganizationProjects: signal([]),
          activeOrganization: signal(undefined),
        },
      },
      { provide: SettingsService, useValue: { serverTimeZone: signal("UTC") } },
      {
        provide: MatDialog,
        useValue: { open: () => ({ afterClosed: () => of(true) }) },
      },
    ],
  });
  TestBed.overrideComponent(IssuesPage, {
    set: {
      template: "",
      providers: [{ provide: IssuesService, useValue: issues }],
    },
  });
  const fixture = TestBed.createComponent(IssuesPage);
  fixture.componentRef.setInput("org-slug", "acme");
  if (query !== undefined) fixture.componentRef.setInput("query", query);
  fixture.detectChanges();
  return { page: fixture.componentInstance, issues };
}

describe("IssuesPage bulk actions with every result selected", () => {
  it("only touch unresolved issues on the default view, like the list", () => {
    const { page, issues } = setup();
    page.updateStatus("resolved");
    page.deleteSelectedIssues();
    page.assignSelected({ value: null, actor: null });
    expect(issues.updateParams).toHaveBeenCalledWith(
      expect.objectContaining({ query: "is:unresolved" }),
    );
    expect(issues.bulkUpdateStatus.mock.calls[0][3]).toBe("is:unresolved");
    expect(issues.bulkDeleteIssues.mock.calls[0][2]).toBe("is:unresolved");
    expect(issues.assign.mock.calls[0][2].query).toBe("is:unresolved");
  });

  it("send the searched query as typed", () => {
    const { page, issues } = setup("is:resolved level:error");
    page.updateStatus("unresolved");
    page.deleteSelectedIssues();
    page.assignSelected({ value: null, actor: null });
    expect(issues.bulkUpdateStatus.mock.calls[0][3]).toBe(
      "is:resolved level:error",
    );
    expect(issues.bulkDeleteIssues.mock.calls[0][2]).toBe(
      "is:resolved level:error",
    );
    expect(issues.assign.mock.calls[0][2].query).toBe(
      "is:resolved level:error",
    );
  });
});
