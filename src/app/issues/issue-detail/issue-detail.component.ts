import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  computed,
  input,
  effect,
  signal,
} from "@angular/core";
import { FormControl, FormGroup } from "@angular/forms";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { MatBadgeModule } from "@angular/material/badge";
import { MatTabsModule } from "@angular/material/tabs";
import { MatCardModule } from "@angular/material/card";
import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { toSignal } from "@angular/core/rxjs-interop";
import { IssueDetailService } from "./issue-detail.service";
import { DaysAgoPipe } from "../../shared/days-ago.pipe";
import { IssueDetailTagsComponent } from "./issue-detail-tags/issue-detail-tags.component";
import { EntryDataComponent } from "src/app/shared/entry-data/entry-data.component";
import { MatDividerModule } from "@angular/material/divider";
import { IssueMasthead } from "./issue-masthead/issue-masthead";
import { LocalDatePipe } from "src/app/shared/date/local-date.pipe";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { OrganizationsService } from "src/app/api/organizations.service";
import { BackLinkComponent } from "src/app/shared/detail/back-link/back-link.component";
import { TopAppBar } from "src/app/shared/top-app-bar/top-app-bar";
import { IssueStatusUpdateDropdownComponent } from "src/app/shared/issue-status-update-dropdown/issue-status-update-dropdown";
import { IssueStatus } from "../interfaces";

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
    IssueDetailTagsComponent,
    EntryDataComponent,
    IssueMasthead,
    MatDividerModule,
    LocalDatePipe,
    DaysAgoPipe,
    BackLinkComponent,
    TopAppBar,
    IssueStatusUpdateDropdownComponent,
  ],
})
export class IssueDetailComponent implements OnInit {
  private issueService = inject(IssueDetailService);
  private organizationsService = inject(OrganizationsService);
  private route = inject(ActivatedRoute);
  protected breakPointObserver = inject(BreakpointObserver);

  issue = this.issueService.issue;

  resolvedInRelease = computed(() => {
    const issue = this.issue();
    if (!issue || issue.status !== "resolved") return null;
    return issue.statusDetails?.["inRelease"] ?? null;
  });

  initialLoadComplete = this.issueService.issueInitialLoadComplete;
  form = new FormGroup({
    assignee: new FormControl(""),
  });
  issueID = input.required<string>({ alias: "issue-id" });
  organization = this.organizationsService.activeOrganization;
  participantCountPluralMapping: { [k: string]: string } = {
    "=0": "No Participants",
    "=1": "1 Participant",
    other: "# Participants",
  };

  isMobile = signal(false);
  smallBreakpointSignal = toSignal(
    this.breakPointObserver.observe([Breakpoints.Small, Breakpoints.XSmall]),
  );

  constructor() {
    effect(() => {
      this.issueService.issueID.set(this.issueID());
    });

    effect(() => {
      const breakpointResult = this.smallBreakpointSignal();
      if (breakpointResult?.matches) {
        this.isMobile.set(true);
      } else {
        this.isMobile.set(false);
      }
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
    if (
      id &&
      window.confirm(
        `Are you sure you want delete this issue? You will permanently lose this issue and all associated events.`,
      )
    ) {
      this.issueService.deleteIssue(id.toString());
    }
  }

  generateBackLink(projectId: string) {
    return {
      ...this.route.snapshot.queryParams,
      project: projectId,
    };
  }
}
