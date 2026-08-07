import {
  Component,
  OnInit,
  inject,
  input,
  ChangeDetectionStrategy,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ProjectSettingsService } from "../../projects/project-settings.service";
import { LoadingButtonComponent } from "../../../shared/loading-button/loading-button.component";
import { MatDividerModule } from "@angular/material/divider";
import { MatOptionModule } from "@angular/material/core";
import { MatSelectModule } from "@angular/material/select";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatCardModule } from "@angular/material/card";
import { OrganizationsService } from "src/app/api/organizations.service";

@Component({
  selector: "gt-team-projects",
  templateUrl: "./team-projects.component.html",
  styleUrls: ["./team-projects.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    ReactiveFormsModule,
    MatOptionModule,
    MatDividerModule,
    RouterLink,
    LoadingButtonComponent,
  ],
})
export class TeamProjectsComponent implements OnInit {
  private projectsService = inject(ProjectSettingsService);
  private organizationsService = inject(OrganizationsService);
  teamSlug = input.required<string>({ alias: "team-slug" });
  orgSlug = input.required<string>({ alias: "org-slug" });

  projectsOnTeam = this.projectsService.projectsOnTeam;
  projectsNotOnTeam = this.projectsService.projectsNotOnTeam;
  loading = this.projectsService.addRemoveLoading;
  errors = this.projectsService.errors;
  project = new FormControl();
  // Both add and remove call project-scoped endpoints (add_team_to_project /
  // remove_team_from_project), so neither depends on team membership.
  canWriteProject = this.organizationsService.canWriteProject;

  ngOnInit(): void {
    this.projectsService.setParams(this.orgSlug(), this.teamSlug());
    this.projectsService.retrieveProjectsOnTeam(
      this.orgSlug(),
      this.teamSlug(),
    );
    this.projectsService.retrieveProjectsNotOnTeam(
      this.orgSlug(),
      this.teamSlug(),
    );
  }

  addProject() {
    const projectSlug = this.project.value;
    this.projectsService.addProjectToTeam(
      this.orgSlug(),
      this.teamSlug(),
      projectSlug,
    );
  }

  removeProject(projectSlug: string) {
    this.projectsService.removeProjectFromTeam(
      this.orgSlug(),
      this.teamSlug(),
      projectSlug,
    );
  }
}
