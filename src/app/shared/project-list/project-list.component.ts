import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  computed,
  inject,
  resource,
  signal,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltipModule } from "@angular/material/tooltip";
import { ProjectsService } from "src/app/projects/projects.service";
import { ProjectCardComponent } from "../project-card/project-card.component";
import { OrganizationsService } from "src/app/api/organizations.service";
import { DatePipe } from "@angular/common";
import { TopAppBar } from "../top-app-bar/top-app-bar";
import { ListTitleComponent } from "src/app/list-elements/list-title/list-title.component";
import { EmptyStateComponent } from "../empty-state/empty-state.component";
import { CountComponent } from "../object-attributes/count.component";
import { OBJECT_ICON } from "../object-identity/object-identity";
import { client } from "../api/api";
import { getPaginationHeaders } from "../pagination.utils";

type ProjectScope = "active" | "all";
type ProjectSort = "name" | "issues" | "created";

/**
 * gt-project-list — the Projects page. Not a mini-dashboard (monitoring lives
 * there); this is the Project *collection* management view — search, sort,
 * filter, and per-project metadata to find and compare projects.
 *
 * Scope is explicit (never a silent override of the sidebar selector): active
 * org by default, with an in-page control to widen to all orgs. Each org renders
 * as an Organization object-summary (identity + vitals + CTA) holding its
 * projects. All controls are client-side over the one global `/projects/` call
 * plus the issue counts; nothing here adds a per-scope fan-out beyond that.
 */
@Component({
  selector: "gt-project-list",
  imports: [
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    DatePipe,
    ProjectCardComponent,
    TopAppBar,
    ListTitleComponent,
    EmptyStateComponent,
    CountComponent,
  ],
  templateUrl: "./project-list.component.html",
  styleUrls: ["./project-list.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectListComponent implements OnInit {
  private organizationsService = inject(OrganizationsService);
  private projectsService = inject(ProjectsService);

  protected readonly projectIcon = OBJECT_ICON.project;
  protected readonly orgIcon = OBJECT_ICON.organization;

  activeOrganization = this.organizationsService.activeOrganization;
  organizations = this.organizationsService.organizations;
  projects = computed(() => this.projectsService.projects() || []);
  orgServiceInitialLoad = this.organizationsService.initialLoad;
  accessProjectWrite = this.organizationsService.accessProjectWrite;

  // --- Collection controls ---
  scope = signal<ProjectScope>("active");
  searchQuery = signal("");
  sortBy = signal<ProjectSort>("name");

  multiOrg = computed(() => this.organizations().length > 1);

  scopeLabel = computed(() =>
    this.scope() === "all"
      ? $localize`All organizations`
      : (this.activeOrganization()?.name ?? ""),
  );

  /** Whether any filter/search is narrowing the set (for the empty message). */
  anyFilterActive = computed(() => !!this.searchQuery().trim());

  /** Orgs with both the full project set (for vitals) and the filtered/sorted
   *  set (for display). Filter + sort are inlined so the concrete Project type
   *  (with `organization`, `slug`, …) flows through. */
  private orgsAndProjects = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const sort = this.sortBy();
    return this.organizations().map((organization) => {
      const all = this.projects().filter(
        (project) => project.organization.id.toString() === organization.id,
      );
      const filtered = all
        .filter((p) => !query || p.name.toLowerCase().includes(query))
        .sort((a, b) => {
          switch (sort) {
            case "issues":
              return (this.getIssueCount(b.id) ?? 0) - (this.getIssueCount(a.id) ?? 0);
            case "created":
              return (
                new Date(b.dateCreated).getTime() -
                new Date(a.dateCreated).getTime()
              );
            default:
              return a.name.localeCompare(b.name);
          }
        });
      return {
        ...organization,
        allProjects: all,
        projects: filtered,
        totalIssues: all.reduce(
          (sum, p) => sum + (this.getIssueCount(p.id) ?? 0),
          0,
        ),
      };
    });
  });

  displayedOrgs = computed(() => {
    const orgs =
      this.scope() === "all"
        ? this.orgsAndProjects()
        : this.orgsAndProjects().filter(
            (org) => org.id === this.activeOrganization()?.id,
          );
    return orgs;
  });

  displayedProjectCount = computed(() =>
    this.displayedOrgs().reduce((sum, org) => sum + org.allProjects.length, 0),
  );

  // Unresolved issue count per project — one lightweight `hits` query per
  // project (no batched endpoint yet; a `stats_v2` is TODO'd on the backend).
  private issueCountsResource = resource({
    params: () => ({ projects: this.projects() }),
    loader: async ({ params }) => {
      const map = new Map<string, number>();
      if (!params.projects.length) return map;
      const results = await Promise.all(
        params.projects.map(async (project) => {
          const { response } = await client.GET(
            "/api/0/organizations/{organization_slug}/issues/",
            {
              params: {
                path: { organization_slug: project.organization.slug },
                query: {
                  query: "is:unresolved",
                  project: [+project.id],
                  limit: 1,
                },
              },
            },
          );
          const pagination = getPaginationHeaders(response);
          return { projectId: project.id.toString(), count: pagination?.hits ?? 0 };
        }),
      );
      for (const { projectId, count } of results) map.set(projectId, count);
      return map;
    },
  });
  private issueCountByProject = computed(
    () => this.issueCountsResource.value() ?? new Map<string, number>(),
  );

  getIssueCount(projectId: string | number): number | undefined {
    return this.issueCountByProject().get(projectId.toString());
  }

  ngOnInit() {
    this.projectsService.retrieveProjects();
  }
}
