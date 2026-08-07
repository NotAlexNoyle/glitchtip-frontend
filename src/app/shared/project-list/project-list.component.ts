import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { ProjectsService } from "src/app/projects/projects.service";
import { ProjectCardComponent } from "../project-card/project-card.component";
import { EmptyProjectsComponent } from "../project-card/empty-projects/empty-projects.component";
import { OrganizationsService } from "src/app/api/organizations.service";
import { DatePipe } from "@angular/common";

@Component({
  selector: "gt-project-list",
  imports: [
    RouterModule,
    MatButtonModule,
    DatePipe,
    MatCardModule,
    ProjectCardComponent,
    EmptyProjectsComponent,
  ],
  templateUrl: "./project-list.component.html",
  styleUrls: ["./project-list.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent implements OnInit {
  private organizationsService = inject(OrganizationsService);
  private projectsService = inject(ProjectsService);

  readonly activeOrgOnly = input(false);

  activeOrganization = this.organizationsService.activeOrganization;
  projects = computed(() => this.projectsService.projects() || []);
  organizations = this.organizationsService.organizations;
  orgServiceInitialLoad = this.organizationsService.initialLoad;
  orgsAndProjects = computed(() =>
    this.organizations().map((organization) => ({
      ...organization,
      projects: this.projects().filter(
        (project) => project.organization.id.toString() === organization.id,
      ),
    })),
  );
  canWriteProject = this.organizationsService.canWriteProject;
  /**
   * Scopes come from the one selected org, but the multi-org view lists every
   * org and no org is selected on "/", so gating there hides the button from
   * everyone. Gate only the single-org view until the org list carries `access`.
   */
  showCreateProject = computed(
    () => !this.activeOrgOnly() || this.canWriteProject(),
  );

  ngOnInit() {
    this.projectsService.retrieveProjects();
  }
}
