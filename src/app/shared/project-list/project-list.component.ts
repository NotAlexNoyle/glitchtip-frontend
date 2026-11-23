import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  Input,
  computed,
  inject,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { ProjectsService } from "src/app/projects/projects.service";
import { ProjectRowsComponent } from "./project-rows.component";
import { PanelComponent } from "../panel/panel.component";
import { EmptyStateComponent } from "../empty-state/empty-state.component";
import { TopAppBar } from "../top-app-bar/top-app-bar";
import { ListTitleComponent } from "src/app/list-elements/list-title/list-title.component";
import { OrganizationsService } from "src/app/api/organizations.service";

// Home lists this many projects per organization; the Projects page lists them all.
export const HOME_PROJECT_LIMIT = 10;

/** Home's share of an org's projects: members first, each group in the API's name order. */
export function homeProjects<T extends { isMember: boolean }>(projects: T[]) {
  return [
    ...projects.filter((project) => project.isMember),
    ...projects.filter((project) => !project.isMember),
  ].slice(0, HOME_PROJECT_LIMIT);
}

@Component({
  selector: "gt-project-list",
  imports: [
    RouterModule,
    MatButtonModule,
    ProjectRowsComponent,
    PanelComponent,
    EmptyStateComponent,
    MatIconModule,
    TopAppBar,
    ListTitleComponent,
  ],
  templateUrl: "./project-list.component.html",
  styleUrls: ["./project-list.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent implements OnInit {
  projectsTitle = $localize`Projects`;
  homeTitle = $localize`Home`;
  noProjectsCanCreate = $localize`Add a project to start capturing errors.`;
  noProjectsAskOwner = $localize`Ask an organization owner, manager or admin to create one.`;
  private organizationsService = inject(OrganizationsService);
  private projectsService = inject(ProjectsService);

  @Input() activeOrgOnly = false;

  activeOrganization = this.organizationsService.activeOrganization;
  projects = computed(() => this.projectsService.projects() || []);
  orgServiceInitialLoad = this.organizationsService.initialLoad;
  // Home and Projects both show only the org you are in.
  organization = computed(() => {
    // The org list stands in while the org's details load, so switching doesn't blank the page.
    const organization =
      this.activeOrganization() ??
      this.organizationsService
        .organizations()
        .find(
          (org) =>
            org.slug === this.organizationsService.activeOrganizationSlug(),
        );
    if (!organization) return undefined;
    const projects = this.projects().filter(
      (project) => project.organization.id.toString() === organization.id,
    );
    return {
      ...organization,
      newProjectLabel: $localize`Create new project in ${organization.name}:organization:`,
      viewAllLabel: $localize`View all projects in ${organization.name}:organization:`,
      projects,
      homeProjects: homeProjects(projects),
      capped: projects.length > HOME_PROJECT_LIMIT,
    };
  });
  activeOrgProjectCount = computed(() => {
    const count = this.organization()?.projects.length;
    return count === undefined ? undefined : String(count);
  });
  canWriteProject = this.organizationsService.canWriteProject;
  // Home can show the first-org fallback, whose scopes aren't known, so it's gated once an org is picked.
  canEdit = computed(
    () =>
      this.canWriteProject() ||
      (!this.activeOrgOnly &&
        !this.organizationsService.selectedOrganizationSlug()),
  );

  ngOnInit() {
    this.projectsService.retrieveProjects();
  }
}
