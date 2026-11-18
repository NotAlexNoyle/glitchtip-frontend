import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { OrganizationsService } from "src/app/api/organizations.service";
import { ProjectsService } from "src/app/projects/projects.service";
import {
  HOME_PROJECT_LIMIT,
  homeProjects,
  ProjectListComponent,
} from "./project-list.component";

describe("homeProjects", () => {
  const project = (name: string, isMember: boolean) => ({ name, isMember });

  it("keeps every project when there are few", () => {
    const projects = [project("a", true), project("b", false)];
    expect(homeProjects(projects)).toEqual(projects);
  });

  it("lists member projects first, keeping each group's order", () => {
    const names = homeProjects([
      project("a", false),
      project("b", true),
      project("c", false),
      project("d", true),
    ]).map((p) => p.name);
    expect(names).toEqual(["b", "d", "a", "c"]);
  });

  it(`stops at ${HOME_PROJECT_LIMIT}`, () => {
    const projects = Array.from({ length: 25 }, (_, i) =>
      project(`p${i}`, i % 2 === 0),
    );
    const shown = homeProjects(projects);
    expect(shown.length).toBe(HOME_PROJECT_LIMIT);
    expect(shown.every((p) => p.isMember)).toBe(true);
  });
});

describe("ProjectListComponent footer", () => {
  const org = { id: "1", slug: "acme", name: "Acme" };

  function render(count: number, activeOrgOnly = false) {
    const projects = Array.from({ length: count }, (_, i) => ({
      id: String(i),
      name: `p${i}`,
      slug: `p${i}`,
      isMember: true,
      firstEvent: null,
      organization: { id: 1 },
    }));
    TestBed.configureTestingModule({
      imports: [ProjectListComponent],
      providers: [
        provideRouter([]),
        {
          provide: OrganizationsService,
          useValue: {
            organizations: signal([org]),
            activeOrganization: signal(org),
            initialLoad: signal(true),
            canWriteProject: signal(true),
            orgPath: (slug: string) => ({ organization_id_or_slug: slug }),
          },
        },
        {
          provide: ProjectsService,
          useValue: { projects: signal(projects), retrieveProjects: () => {} },
        },
      ],
    });
    const fixture = TestBed.createComponent(ProjectListComponent);
    fixture.componentInstance.activeOrgOnly = activeOrgOnly;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const footerText = (el: HTMLElement) =>
    el.querySelector(".gt-panel__footer")?.textContent?.replace(/\s+/g, " ");

  it("shows the count and a View all link when Home caps the list", () => {
    const el = render(11);
    expect(el.querySelectorAll("gt-list-row").length).toBe(HOME_PROJECT_LIMIT);
    expect(footerText(el)).toContain("10 of 11 projects");
    const link = el.querySelector<HTMLAnchorElement>(
      ".gt-panel__footer-actions a",
    )!;
    expect(link.textContent?.trim()).toBe("View all projects");
    expect(link.getAttribute("href")).toBe("/acme/projects");
  });

  it("has no footer when every project fits", () => {
    const el = render(HOME_PROJECT_LIMIT);
    expect(el.querySelector(".gt-panel__footer-actions a")).toBeNull();
    expect(footerText(el)?.trim() ?? "").toBe("");
  });

  it("lists every project on the Projects page", () => {
    const el = render(11, true);
    expect(el.querySelectorAll("gt-list-row").length).toBe(11);
    expect(el.querySelector(".gt-panel__footer-actions a")).toBeNull();
  });
});
