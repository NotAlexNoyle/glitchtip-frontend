import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  effect,
  untracked,
} from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { MatTabsModule } from "@angular/material/tabs";
import { toSignal } from "@angular/core/rxjs-interop";
import { BreakpointObserver } from "@angular/cdk/layout";
import { map } from "rxjs";
import { PageHeaderComponent } from "src/app/shared/detail/page-header/page-header.component";
import { IssueDetailService } from "./issue-detail.service";
import { DaysAgoPipe } from "../../shared/days-ago.pipe";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { OrganizationsService } from "src/app/api/organizations.service";
import { DatePipe, DecimalPipe, TitleCasePipe } from "@angular/common";
import { BackLinkComponent } from "src/app/shared/detail/back-link/back-link.component";
import { TopAppBar } from "src/app/shared/top-app-bar/top-app-bar";
import { IssueStatusUpdateDropdownComponent } from "src/app/shared/issue-status-update-dropdown/issue-status-update-dropdown";
import { IssueStatus } from "../interfaces";
import { ConfirmDialogComponent } from "src/app/shared/confirm-dialog/confirm-dialog.component";
import { MatDialog } from "@angular/material/dialog";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { EmptyStateComponent } from "src/app/shared/empty-state/empty-state.component";
import { IssueTagsSummaryComponent } from "./issue-tags-summary/issue-tags-summary.component";

const ISSUE_STATUS: Record<IssueStatus, { label: string; color: string }> = {
  unresolved: { label: $localize`Unresolved`, color: "var(--info-color)" },
  resolved: { label: $localize`Resolved`, color: "var(--success-color)" },
  ignored: { label: $localize`Ignored`, color: "var(--mat-sys-outline)" },
};

@Component({
  selector: "gt-issue-detail",
  templateUrl: "./issue-detail.component.html",
  styleUrls: ["./issue-detail.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    TitleCasePipe,
    DatePipe,
    DecimalPipe,
    DaysAgoPipe,
    PageHeaderComponent,
    BackLinkComponent,
    TopAppBar,
    IssueStatusUpdateDropdownComponent,
    PanelComponent,
    EmptyStateComponent,
    IssueTagsSummaryComponent,
  ],
})
export class IssueDetailComponent implements OnInit {
  private issueService = inject(IssueDetailService);
  private organizationsService = inject(OrganizationsService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  /** Narrow screens keep the back link short. */
  private readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe("(max-width: 599.98px)")
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );
  readonly issueNotFoundMessage =
    $localize`This may be because the URL is pointing to an issue that doesn't exist or was deleted.` +
    " " +
    $localize`It's also possible that this issue was reported to a project that you are not able to access.`;

  issue = this.issueService.issue;
  issueTitle = computed(() => {
    const issue = this.issue();
    if (!issue) {
      return ["", null] as [string, string | null];
    }
    const metadata = issue.metadata ?? {};
    const culprit = issue.culprit;
    const fallback = issue.title || "";

    switch (issue.type) {
      case "error":
        if (metadata.type) {
          return [metadata.type, culprit] as [string, string | null];
        }
        return [metadata.function || fallback, culprit] as [
          string,
          string | null,
        ];
      case "csp":
        return [metadata.directive || fallback, metadata.uri || null] as [
          string,
          string | null,
        ];
      case "default":
        return [metadata.message || fallback, metadata.origin || null] as [
          string,
          string | null,
        ];
      default:
        return [metadata.title || fallback, null] as [string, string | null];
    }
  });
  issueSubtitle = computed<string>(() => {
    const issue = this.issue();
    if (!issue || issue.metadata === null) {
      return "";
    }
    const metadata = issue.metadata;
    switch (issue.type) {
      case "error":
        return metadata.value as string;
      case "csp":
        return metadata.message as string;
      case "default":
        return "";
      default:
        return issue.culprit as string;
    }
  });

  userCount = this.issueService.userCount;

  firstSeenTip = computed(() => {
    const issue = this.issue();
    if (!issue) return "";
    const date = new Date(issue.firstSeen).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return $localize`First seen ${date}`;
  });

  backLinkText = computed(() => {
    const project = this.issue()?.project.name;
    return this.narrow() || !project
      ? $localize`Issues`
      : $localize`All issues for ${project}:project:`;
  });

  backLinkParams = computed(() => {
    const projectId = this.issue()?.project.id;
    return projectId
      ? { ...this.route.snapshot.queryParams, project: projectId }
      : {};
  });

  status = computed(() => ISSUE_STATUS[this.issue()?.status ?? "unresolved"]);

  resolvedInRelease = computed(() => {
    const issue = this.issue();
    if (!issue || issue.status !== "resolved") return null;
    return issue.statusDetails?.["inRelease"] ?? null;
  });

  initialLoadComplete = this.issueService.issueInitialLoadComplete;
  issueID = input.required<string>({ alias: "issue-id" });
  organization = this.organizationsService.activeOrganization;

  constructor() {
    effect(() => {
      const id = this.issueID();
      this.issueService.issueID.set(id);
      untracked(() => {
        if (+id) this.issueService.retrieveTags(+id);
      });
    });
  }

  ngOnInit() {
    this.issueService.clearState();
  }

  updateIssueStatus(status: IssueStatus) {
    this.issueService.setStatus(status);
  }

  resolveInNextRelease() {
    this.issueService.setStatus("resolved", { inNextRelease: true });
  }

  deleteIssue() {
    const id = this.issueID();
    if (!id) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: $localize`Delete issue?`,
        message: $localize`Are you sure you want to delete this issue? You will permanently lose this issue and all associated events.`,
        confirmText: $localize`Delete`,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.issueService.deleteIssue(id.toString());
      }
    });
  }
}
