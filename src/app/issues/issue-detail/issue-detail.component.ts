import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  effect,
} from "@angular/core";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { MatBadgeModule } from "@angular/material/badge";
import { MatTabsModule } from "@angular/material/tabs";
import { MatCardModule } from "@angular/material/card";
import { PageHeaderComponent } from "src/app/shared/detail/page-header/page-header.component";
import { IssueDetailService } from "./issue-detail.service";
import { DaysAgoPipe } from "../../shared/days-ago.pipe";
import { IssueDetailTagsComponent } from "./issue-detail-tags/issue-detail-tags.component";
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
import { MatMenuModule } from "@angular/material/menu";
import {
  AssigneeChoice,
  AssigneePickerComponent,
} from "src/app/shared/assignee-picker/assignee-picker";
import { assigneeLabel } from "src/app/shared/assignee-picker/assignee-options.service";

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
    MatCardModule,
    RouterModule,
    MatTabsModule,
    MatBadgeModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    IssueDetailTagsComponent,
    TitleCasePipe,
    DatePipe,
    DecimalPipe,
    DaysAgoPipe,
    PageHeaderComponent,
    BackLinkComponent,
    TopAppBar,
    IssueStatusUpdateDropdownComponent,
    MatMenuModule,
    AssigneePickerComponent,
  ],
})
export class IssueDetailComponent implements OnInit {
  private issueService = inject(IssueDetailService);
  private organizationsService = inject(OrganizationsService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);

  assignee = computed(() => this.issue()?.assignedTo ?? null);
  assigneeLabel = computed(() => {
    const actor = this.assignee();
    return actor ? assigneeLabel(actor) : null;
  });
  assigneeIcon = computed(() => {
    const actor = this.assignee();
    return actor?.type === "team" ? "groups" : "person";
  });
  // The label truncates, so the full name lives in the tooltip.
  assigneeTip = computed(() => {
    const label = this.assigneeLabel();
    return label ? $localize`Assigned to ${label}` : $localize`Assign issue`;
  });
  readonly assignText = $localize`Assign`;

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

  status = computed(() => ISSUE_STATUS[this.issue()?.status ?? "unresolved"]);

  resolvedInRelease = computed(() => {
    const issue = this.issue();
    if (!issue || issue.status !== "resolved") return null;
    return issue.statusDetails?.["inRelease"] ?? null;
  });

  initialLoadComplete = this.issueService.issueInitialLoadComplete;
  issueID = input.required<string>({ alias: "issue-id" });
  organization = this.organizationsService.activeOrganization;
  participantCountPluralMapping: { [k: string]: string } = {
    "=0": "No Participants",
    "=1": "1 Participant",
    other: "# Participants",
  };

  constructor() {
    effect(() => {
      this.issueService.issueID.set(this.issueID());
    });
  }

  ngOnInit() {
    this.issueService.clearState();
  }

  updateIssueStatus(status: IssueStatus) {
    this.issueService.setStatus(status);
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

  generateBackLink(projectId: string) {
    return {
      ...this.route.snapshot.queryParams,
      project: projectId,
    };
  }
}
