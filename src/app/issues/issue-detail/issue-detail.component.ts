import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  effect,
  LOCALE_ID,
  viewChild,
  ElementRef,
} from "@angular/core";
import { CompactNumberPipe } from "src/app/shared/compact-number.pipe";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { MatTabsModule } from "@angular/material/tabs";
import { PageHeaderComponent } from "src/app/shared/detail/page-header/page-header.component";
import { IssueDetailService } from "./issue-detail.service";
import { DaysAgoPipe } from "../../shared/days-ago.pipe";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { MatTooltipModule } from "@angular/material/tooltip";
import { OrganizationsService } from "src/app/api/organizations.service";
import {
  DatePipe,
  DecimalPipe,
  TitleCasePipe,
  NgTemplateOutlet,
  formatDate,
} from "@angular/common";
import { BackLinkComponent } from "src/app/shared/detail/back-link/back-link.component";
import { RecordBandComponent } from "src/app/shared/record-band/record-band.component";
import { TopAppBar } from "src/app/shared/top-app-bar/top-app-bar";
import { IssueStatusUpdateDropdownComponent } from "src/app/shared/issue-status-update-dropdown/issue-status-update-dropdown";
import { IssueStatus } from "../interfaces";
import { ISSUE_STATUS } from "../issue-status";
import { ConfirmDialogComponent } from "src/app/shared/confirm-dialog/confirm-dialog.component";
import { MatDialog } from "@angular/material/dialog";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { EmptyStateComponent } from "src/app/shared/empty-state/empty-state.component";
import { IssueTagsSummaryComponent } from "./issue-tags-summary/issue-tags-summary.component";
import { take } from "rxjs";
import { MatMenuModule, MatMenuTrigger } from "@angular/material/menu";
import {
  AssigneeChoice,
  AssigneePickerComponent,
} from "src/app/shared/assignee-picker/assignee-picker";
import {
  assigneeInitials,
  assigneeLabel,
} from "src/app/shared/assignee-picker/assignee-options.service";

@Component({
  selector: "gt-issue-detail",
  templateUrl: "./issue-detail.component.html",
  styleUrls: ["./issue-detail.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CompactNumberPipe,
    NgTemplateOutlet,
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
    RecordBandComponent,
    BackLinkComponent,
    TopAppBar,
    IssueStatusUpdateDropdownComponent,
    PanelComponent,
    EmptyStateComponent,
    IssueTagsSummaryComponent,
    MatMenuModule,
    AssigneePickerComponent,
  ],
})
export class IssueDetailComponent implements OnInit {
  private issueService = inject(IssueDetailService);
  private organizationsService = inject(OrganizationsService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private locale = inject(LOCALE_ID);

  assignee = computed(() => this.issue()?.assignedTo ?? null);
  assigneeLabel = computed(() => {
    const actor = this.assignee();
    return actor ? assigneeLabel(actor) : null;
  });
  assigneeIcon = computed(() => {
    const actor = this.assignee();
    return actor?.type === "team" ? "groups" : "person";
  });
  /** Initials in the bar: a circle for a person, a square for a team. */
  assigneeInitials = computed(() => {
    const actor = this.assignee();
    return actor ? assigneeInitials(actor) : null;
  });
  // The button shows initials or an icon, so the full name lives in the tooltip.
  assigneeTip = computed(() => {
    const label = this.assigneeLabel();
    return label ? $localize`Assigned to ${label}` : $localize`Assign issue`;
  });

  readonly issueNotFoundMessage = [
    $localize`This may be because the URL is pointing to an issue that doesn't exist or was deleted.`,
    $localize`It's also possible that this issue was reported to a project that you are not able to access.`,
  ];

  readonly issue = this.issueService.issue;
  readonly issueTitle = computed(() => {
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
  readonly issueSubtitle = computed<string>(() => {
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

  readonly userCount = this.issueService.userCount;

  readonly usersTip = computed(() => {
    const users = this.userCount();
    return users
      ? $localize`Distinct ${users.key}:key: values across all events (${users.tagged}:tagged: tagged)`
      : "";
  });

  readonly firstSeenTip = computed(() => {
    const issue = this.issue();
    if (!issue) return "";
    const date = formatDate(issue.firstSeen, "medium", this.locale);
    return $localize`First seen ${date}:date:`;
  });

  readonly backLinkParams = computed(() => {
    const projectId = this.issue()?.project.id;
    return projectId
      ? { ...this.route.snapshot.queryParams, project: projectId }
      : {};
  });

  readonly status = computed(
    () => ISSUE_STATUS[this.issue()?.status ?? "unresolved"],
  );

  readonly resolvedInRelease = computed(() => {
    const issue = this.issue();
    if (!issue || issue.status !== "resolved") return null;
    return issue.statusDetails?.["inRelease"] ?? null;
  });

  readonly initialLoadComplete = this.issueService.issueInitialLoadComplete;
  readonly issueID = input.required<string>({ alias: "issue-id" });
  readonly orgSlug = input.required<string>({ alias: "org-slug" });
  readonly organization = this.organizationsService.activeOrganization;

  constructor() {
    effect(() => {
      // The event view sets it too, but only once the issue has loaded.
      const eventID =
        this.route.firstChild?.snapshot.paramMap.get("event-id") ?? null;
      this.issueService.open(this.orgSlug(), this.issueID(), eventID);
    });
  }

  ngOnInit() {
    this.issueService.clearState();
  }

  updateIssueStatus(status: IssueStatus) {
    this.issueService.setStatus(status);
  }

  private narrowPicker = viewChild<MatMenuTrigger>("narrowPicker");

  private moreButton = viewChild<string, ElementRef<HTMLElement>>(
    "moreButton",
    {
      read: ElementRef,
    },
  );

  /** Narrow bar: the More menu hands over to the picker once it has closed. */
  openNarrowPicker() {
    setTimeout(() => {
      const trigger = this.narrowPicker();
      if (!trigger) return;
      // The anchor can't take focus, so give it back to More actions.
      trigger.menuClosed
        .pipe(take(1))
        .subscribe(() => this.moreButton()?.nativeElement.focus());
      trigger.openMenu();
    });
  }

  setAssignee(choice: AssigneeChoice) {
    this.issueService.setAssignee(choice);
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
