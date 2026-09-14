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
import { DecimalPipe } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import { MatCardModule } from "@angular/material/card";
import { MatDividerModule } from "@angular/material/divider";
import { MatIconModule } from "@angular/material/icon";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatSelectChange, MatSelectModule } from "@angular/material/select";
import { TopAppBar } from "../shared/top-app-bar/top-app-bar";
import { ProjectCardComponent } from "../shared/project-card/project-card.component";
import {
  SparklineComponent,
  SparklineDataPoint,
  SparklineSeries,
} from "../shared/sparkline/sparkline";
import { ProjectsService } from "../projects/projects.service";
import { OrganizationsService } from "../api/organizations.service";
import { client } from "../shared/api/api";
import { components } from "../api/api-schema";
import { getPaginationHeaders } from "../shared/pagination.utils";
import { ObjectCardComponent } from "../shared/object-identity/object-card.component";
import { EmptyStateComponent } from "../shared/empty-state/empty-state.component";
import { OBJECT_ICON } from "../shared/object-identity/object-identity";
import { CountComponent } from "../shared/object-attributes/count.component";
import { PercentComponent } from "../shared/object-attributes/percent.component";

type EventsTimePeriod = "1h" | "6h" | "24h" | "7d";

@Component({
  selector: "gt-home",
  templateUrl: "./home.component.html",
  styleUrls: ["./home.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    DecimalPipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDividerModule,
    MatIconModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    TopAppBar,
    ProjectCardComponent,
    SparklineComponent,
    ObjectCardComponent,
    EmptyStateComponent,
    CountComponent,
    PercentComponent,
  ],
})
export class HomeComponent implements OnInit {
  private organizationsService = inject(OrganizationsService);
  private projectsService = inject(ProjectsService);

  // Project's identity icon, for the "no projects yet" empty state — its
  // empty-collection representation.
  protected readonly projectIcon = OBJECT_ICON.project;
  protected readonly projectsLoaded = this.projectsService.initialLoadComplete;

  organizations = this.organizationsService.organizations;
  activeOrganization = this.organizationsService.activeOrganization;
  activeOrgSlug = this.organizationsService.activeOrganizationSlug;
  orgServiceInitialLoad = this.organizationsService.initialLoad;
  accessProjectWrite = this.organizationsService.accessProjectWrite;

  projects = computed(() => this.projectsService.projects() || []);

  activeOrgProjects = computed(() => {
    const orgId = this.activeOrganization()?.id;
    if (!orgId) return [];
    return this.projects().filter(
      (p) => p.organization.id.toString() === orgId,
    );
  });

  // --- Monitors ---
  private monitorsResource = resource({
    params: () => ({ orgSlug: this.activeOrgSlug() }),
    loader: async ({ params }) => {
      if (!params.orgSlug) return [];
      const { data } = await client.GET(
        "/api/0/organizations/{organization_slug}/monitors/",
        {
          params: { path: { organization_slug: params.orgSlug } },
        },
      );
      return data ?? ([] as components["schemas"]["MonitorSchema"][]);
    },
  });

  monitors = computed(() => this.monitorsResource.value() ?? []);
  monitorsUp = computed(
    () => this.monitors().filter((m) => m.isUp === true).length,
  );
  monitorsTotal = computed(() => this.monitors().length);
  uptimePercent = computed(() => {
    const total = this.monitorsTotal();
    if (total === 0) return null;
    return Math.round((this.monitorsUp() / total) * 100);
  });

  // --- Issues (unresolved count + new vs recurring + previous period for trend) ---
  private issuesResource = resource({
    params: () => ({ orgSlug: this.activeOrgSlug() }),
    loader: async ({ params }) => {
      if (!params.orgSlug) return { total: 0, newCount: 0, prevNewCount: 0 };

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      // Fetch total unresolved count
      const { response: totalResponse } = await client.GET(
        "/api/0/organizations/{organization_slug}/issues/",
        {
          params: {
            path: { organization_slug: params.orgSlug },
            query: { query: "is:unresolved", limit: 1 },
          },
        },
      );
      const totalPagination = getPaginationHeaders(totalResponse);

      // Fetch new issues (first seen in last 24h)
      const { response: newResponse } = await client.GET(
        "/api/0/organizations/{organization_slug}/issues/",
        {
          params: {
            path: { organization_slug: params.orgSlug },
            query: {
              query: "is:unresolved",
              start: oneDayAgo.toISOString(),
              sort: "first_seen",
              limit: 1,
            },
          },
        },
      );
      const newPagination = getPaginationHeaders(newResponse);

      // Fetch previous period issues (24-48h ago) for trend comparison
      const { response: prevResponse } = await client.GET(
        "/api/0/organizations/{organization_slug}/issues/",
        {
          params: {
            path: { organization_slug: params.orgSlug },
            query: {
              query: "is:unresolved",
              start: twoDaysAgo.toISOString(),
              end: oneDayAgo.toISOString(),
              sort: "first_seen",
              limit: 1,
            },
          },
        },
      );
      const prevPagination = getPaginationHeaders(prevResponse);

      return {
        total: totalPagination?.hits ?? 0,
        newCount: newPagination?.hits ?? 0,
        prevNewCount: prevPagination?.hits ?? 0,
      };
    },
  });

  unresolvedIssuesCount = computed(
    () => this.issuesResource.value()?.total ?? 0,
  );
  newIssuesCount = computed(() => this.issuesResource.value()?.newCount ?? 0);
  recurringIssuesCount = computed(
    () => this.unresolvedIssuesCount() - this.newIssuesCount(),
  );
  prevNewIssuesCount = computed(
    () => this.issuesResource.value()?.prevNewCount ?? 0,
  );

  /** Trend direction: 'up' = more new issues than prev period, 'down' = fewer, 'flat' = same */
  issuesTrend = computed<"up" | "down" | "flat">(() => {
    const current = this.newIssuesCount();
    const prev = this.prevNewIssuesCount();
    if (current > prev) return "up";
    if (current < prev) return "down";
    return "flat";
  });

  /** Percentage change in new issues vs previous 24h */
  issuesTrendPercent = computed(() => {
    const current = this.newIssuesCount();
    const prev = this.prevNewIssuesCount();
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  });

  // --- Transactions (performance) ---
  private transactionsResource = resource({
    params: () => ({ orgSlug: this.activeOrgSlug() }),
    loader: async ({ params }) => {
      if (!params.orgSlug) return [];
      const { data } = await client.GET(
        "/api/0/organizations/{organization_slug}/transaction-groups/",
        {
          params: {
            path: { organization_slug: params.orgSlug },
            query: { sort: "-count", limit: 100 },
          },
        },
      );
      return data ?? [];
    },
  });

  transactions = computed(() => this.transactionsResource.value() ?? []);

  avgResponseTime = computed(() => {
    const txns = this.transactions();
    if (txns.length === 0) return null;
    const totalWeighted = txns.reduce(
      (sum, t) => sum + t.avgDuration * t.count,
      0,
    );
    const totalCount = txns.reduce((sum, t) => sum + t.count, 0);
    if (totalCount === 0) return null;
    return Math.round(totalWeighted / totalCount);
  });

  /** Weighted p50 across all transactions */
  p50ResponseTime = computed(() => {
    const txns = this.transactions().filter((t) => t.p50 != null);
    if (txns.length === 0) return null;
    const totalWeighted = txns.reduce(
      (sum, t) => sum + (t.p50 ?? 0) * t.count,
      0,
    );
    const totalCount = txns.reduce((sum, t) => sum + t.count, 0);
    if (totalCount === 0) return null;
    return Math.round(totalWeighted / totalCount);
  });

  /** Weighted p95 across all transactions */
  p95ResponseTime = computed(() => {
    const txns = this.transactions().filter((t) => t.p95 != null);
    if (txns.length === 0) return null;
    const totalWeighted = txns.reduce(
      (sum, t) => sum + (t.p95 ?? 0) * t.count,
      0,
    );
    const totalCount = txns.reduce((sum, t) => sum + t.count, 0);
    if (totalCount === 0) return null;
    return Math.round(totalWeighted / totalCount);
  });

  totalTransactions = computed(() =>
    this.transactions().reduce((sum, t) => sum + t.count, 0),
  );

  /** Org-wide error rate from transactions */
  errorRate = computed(() => {
    const txns = this.transactions();
    const totalCount = txns.reduce((sum, t) => sum + t.count, 0);
    if (totalCount === 0) return null;
    const totalErrors = txns.reduce((sum, t) => sum + t.errorCount, 0);
    return totalErrors / totalCount;
  });

  errorRatePercent = computed(() => {
    const rate = this.errorRate();
    if (rate === null) return null;
    return (rate * 100).toFixed(2);
  });

  totalErrorCount = computed(() =>
    this.transactions().reduce((sum, t) => sum + t.errorCount, 0),
  );

  // --- Per-project issue counts ---
  private perProjectIssuesResource = resource({
    params: () => ({
      orgSlug: this.activeOrgSlug(),
      projects: this.activeOrgProjects(),
    }),
    loader: async ({ params }) => {
      if (!params.orgSlug || params.projects.length === 0)
        return new Map<string, number>();

      const map = new Map<string, number>();
      // Fetch issue count per project in parallel
      const results = await Promise.all(
        params.projects.map(async (project) => {
          const { response } = await client.GET(
            "/api/0/organizations/{organization_slug}/issues/",
            {
              params: {
                path: { organization_slug: params.orgSlug! },
                query: {
                  query: "is:unresolved",
                  project: [+project.id],
                  limit: 1,
                },
              },
            },
          );
          const pagination = getPaginationHeaders(response);
          return {
            projectId: project.id.toString(),
            count: pagination?.hits ?? 0,
          };
        }),
      );

      for (const { projectId, count } of results) {
        map.set(projectId, count);
      }
      return map;
    },
  });

  issueCountByProject = computed(
    () => this.perProjectIssuesResource.value() ?? new Map<string, number>(),
  );

  getIssueCountForProject(projectId: number | string): number | undefined {
    return this.issueCountByProject().get(projectId.toString());
  }

  /** Per-project average response time */
  responseTimeByProject = computed(() => {
    const map = new Map<string, number>();
    const txns = this.transactions();
    const byProject = new Map<string, { weightedSum: number; count: number }>();

    for (const t of txns) {
      const pid = t.project.toString();
      const existing = byProject.get(pid) ?? { weightedSum: 0, count: 0 };
      existing.weightedSum += t.avgDuration * t.count;
      existing.count += t.count;
      byProject.set(pid, existing);
    }

    for (const [pid, data] of byProject) {
      if (data.count > 0) {
        map.set(pid, Math.round(data.weightedSum / data.count));
      }
    }
    return map;
  });

  /** Per-project error count from transactions */
  errorCountByProject = computed(() => {
    const map = new Map<string, number>();
    for (const t of this.transactions()) {
      const pid = t.project.toString();
      map.set(pid, (map.get(pid) ?? 0) + t.errorCount);
    }
    return map;
  });

  /** Projects sorted by severity: issue count desc, then event count desc */
  sortedActiveOrgProjects = computed(() => {
    const projects = [...this.activeOrgProjects()];
    const issueCounts = this.issueCountByProject();
    const errorStats = this.errorStatsByProject();

    return projects.sort((a, b) => {
      const aIssues = issueCounts.get(a.id.toString()) ?? 0;
      const bIssues = issueCounts.get(b.id.toString()) ?? 0;
      if (bIssues !== aIssues) return bIssues - aIssues;
      // Secondary sort by event count
      const aEvents = (errorStats.get(a.id.toString()) ?? []).reduce(
        (sum, p) => sum + p.value,
        0,
      );
      const bEvents = (errorStats.get(b.id.toString()) ?? []).reduce(
        (sum, p) => sum + p.value,
        0,
      );
      return bEvents - aEvents;
    });
  });

  // --- Mock error stats per project (replace with stats_v2 later) ---
  errorStatsByProject = computed(() => {
    const map = new Map<string, SparklineDataPoint[]>();
    const now = new Date();
    for (const project of this.activeOrgProjects()) {
      const seed = +project.id;
      const points: SparklineDataPoint[] = [];
      for (let i = 23; i >= 0; i--) {
        points.push({
          name: new Date(now.getTime() - i * 60 * 60 * 1000),
          value: Math.floor(
            Math.abs(Math.sin(seed + i * 0.5)) * 30 + Math.random() * 10,
          ),
        });
      }
      map.set(project.id.toString(), points);
    }
    return map;
  });

  /** Stacked series: new issues vs recurring issues */
  orgErrorStacked = computed<SparklineSeries[]>(() => {
    const byProject = this.errorStatsByProject();
    if (byProject.size === 0) return [];

    const newTotals = new Map<number, number>();
    const recurringTotals = new Map<number, number>();

    for (const points of byProject.values()) {
      for (const point of points) {
        const time = point.name.getTime();
        // Mock split: ~20% new, ~80% recurring
        const newVal = Math.floor(point.value * 0.2);
        const recurVal = point.value - newVal;
        newTotals.set(time, (newTotals.get(time) ?? 0) + newVal);
        recurringTotals.set(time, (recurringTotals.get(time) ?? 0) + recurVal);
      }
    }

    const times = Array.from(newTotals.keys()).sort((a, b) => a - b);
    return [
      {
        name: $localize`Recurring`,
        series: times.map((t) => ({
          name: new Date(t),
          value: recurringTotals.get(t) ?? 0,
        })),
      },
      {
        name: $localize`New`,
        series: times.map((t) => ({
          name: new Date(t),
          value: newTotals.get(t) ?? 0,
        })),
      },
    ];
  });

  orgErrorTotal = computed(() => {
    const stacked = this.orgErrorStacked();
    return stacked.reduce(
      (sum, series) => sum + series.series.reduce((s, p) => s + p.value, 0),
      0,
    );
  });

  orgErrorColors = [
    { name: $localize`Recurring`, value: "var(--mat-sys-secondary)" },
    { name: $localize`New`, value: "var(--mat-sys-error)" },
  ];

  // --- Events chart time period ---
  eventsTimePeriod = signal<EventsTimePeriod>("24h");

  private eventsTimePeriodHours = computed(() => {
    switch (this.eventsTimePeriod()) {
      case "1h":
        return 1;
      case "6h":
        return 6;
      case "24h":
        return 24;
      case "7d":
        return 168;
    }
  });

  eventsTimePeriodLabel = computed(() => {
    switch (this.eventsTimePeriod()) {
      case "1h":
        return $localize`Events (1h)`;
      case "6h":
        return $localize`Events (6h)`;
      case "24h":
        return $localize`Events (24h)`;
      case "7d":
        return $localize`Events (7d)`;
    }
  });

  /** Stacked series filtered by the selected time period */
  filteredOrgErrorStacked = computed<SparklineSeries[]>(() => {
    const stacked = this.orgErrorStacked();
    const hours = this.eventsTimePeriodHours();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    return stacked.map((series) => ({
      name: series.name,
      series: series.series.filter((p) => p.name >= cutoff),
    }));
  });

  filteredOrgErrorTotal = computed(() => {
    return this.filteredOrgErrorStacked().reduce(
      (sum, series) => sum + series.series.reduce((s, p) => s + p.value, 0),
      0,
    );
  });

  // --- Loading states ---
  issuesLoading = computed(() => this.issuesResource.isLoading());
  monitorsLoading = computed(() => this.monitorsResource.isLoading());
  transactionsLoading = computed(() => this.transactionsResource.isLoading());
  projectIssuesLoading = computed(() =>
    this.perProjectIssuesResource.isLoading(),
  );

  getErrorStatsForProject(projectId: number | string): SparklineDataPoint[] {
    return this.errorStatsByProject().get(projectId.toString()) ?? [];
  }

  getResponseTimeForProject(projectId: number | string): number | null {
    return this.responseTimeByProject().get(projectId.toString()) ?? null;
  }

  ngOnInit() {
    this.projectsService.retrieveProjects();
  }

  onOrgChange(event: MatSelectChange) {
    if (event.value) {
      this.organizationsService.setActiveOrganizationSlug(event.value);
    }
  }
}
