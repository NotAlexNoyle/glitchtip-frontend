// Type-only: declares the $localize global for the spec program. The runtime
// polyfill is already loaded by the test builder.
import type {} from "@angular/localize/init";
import { describe, expect, it, vi } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { IssuesService } from "../issues.service";
import { ProjectsService } from "src/app/projects/projects.service";
import { OrganizationsService } from "src/app/api/organizations.service";
import { IssueZeroStatesComponent } from "./issue-zero-states.component";

// Two projects with events and none picked: the empty states, not onboarding.
function setup(filtersActive: boolean) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: IssuesService,
        useValue: { loading: signal(false), initialLoad: signal(true) },
      },
      {
        provide: ProjectsService,
        useValue: {
          loading: signal(false),
          initialLoadComplete: signal(true),
          projects: signal([]),
          retrieveProjects: vi.fn(),
        },
      },
      {
        provide: OrganizationsService,
        useValue: {
          projectsCount: signal(2),
          activeOrganizationProjects: signal([
            { id: "1", isMember: true },
            { id: "2", isMember: true },
          ]),
          activeOrganizationSlug: signal("acme"),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(IssueZeroStatesComponent);
  fixture.componentRef.setInput("filtersActive", filtersActive);
  fixture.detectChanges();
  return fixture;
}

describe("IssueZeroStatesComponent", () => {
  it("offers Clear filters when the search or band has something to clear", () => {
    const fixture = setup(true);
    const cleared = vi.fn();
    fixture.componentInstance.cleared.subscribe(cleared);

    expect(fixture.componentInstance.zeroStateKind()).toBe("no-results");
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      "[data-cy=no-results]",
    );
    button.click();
    expect(cleared).toHaveBeenCalledOnce();
  });

  it("blames the project and time range when there is nothing to clear", () => {
    const fixture = setup(false);
    expect(fixture.componentInstance.zeroStateKind()).toBe("no-issues");
    expect(
      fixture.nativeElement.querySelector("[data-cy=no-results]"),
    ).toBeNull();
  });
});
