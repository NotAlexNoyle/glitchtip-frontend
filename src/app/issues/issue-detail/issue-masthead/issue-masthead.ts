import { Component, ChangeDetectionStrategy, computed, input } from "@angular/core";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { DetailMastheadComponent } from "src/app/shared/detail/masthead/detail-masthead.component";
import { StatComponent } from "src/app/shared/stat/stat.component";
import { DaysAgoPipe } from "src/app/shared/days-ago.pipe";
import { IssuePulse } from "../issue-pulse/issue-pulse";
import { components } from "src/app/api/api-schema";

type IssueDetail = components["schemas"]["IssueDetailSchema"];

const STATUS_ICON = {
  resolved: "done",
  unresolved: "priority_high",
  ignored: "notifications_off",
} as const;

/**
 * gt-issue-masthead — the issue detail header module: identity (title + message),
 * the vitals cluster (gt-stat), and the pulse (or an honest one-liner when the
 * issue is too infrequent to chart). Rendered inside an outlined card so it reads
 * as a sibling module to the content and rail cards below.
 */
@Component({
  selector: "gt-issue-masthead",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DetailMastheadComponent,
    StatComponent,
    IssuePulse,
    DaysAgoPipe,
    TitleCasePipe,
    MatIconModule,
  ],
  templateUrl: "./issue-masthead.html",
  styleUrl: "./issue-masthead.scss",
})
export class IssueMasthead {
  readonly issue = input.required<IssueDetail>();

  statusIcon = computed(() => {
    const status = this.issue().status as keyof typeof STATUS_ICON;
    return STATUS_ICON[status] ?? "error";
  });

  issueTitle = computed<[string, string | null]>(() => {
    const issue = this.issue();
    const metadata = (issue.metadata ?? {}) as Record<string, string | undefined>;
    const culprit = issue.culprit ?? null;
    const fallback = issue.title || "";
    switch (issue.type) {
      case "error":
        if (metadata.type) return [metadata.type, culprit];
        return [metadata.function || fallback, culprit];
      case "csp":
        return [metadata.directive || fallback, metadata.uri || null];
      case "default":
        return [metadata.message || fallback, metadata.origin || null];
      default:
        return [metadata.title || fallback, null];
    }
  });

  issueSubtitle = computed<string>(() => {
    const issue = this.issue();
    if (issue.metadata === null) return "";
    const metadata = issue.metadata as Record<string, string | undefined>;
    switch (issue.type) {
      case "error":
        // Headline "what happened". The exception block below still shows the
        // full chain (incl. root cause), so this isn't the only place it lives.
        return metadata.value ?? "";
      case "csp":
        return metadata.message ?? "";
      case "default":
        return "";
      default:
        return issue.culprit ?? "";
    }
  });

  // The pulse only earns its space when there's a trend to read; below this we
  // show an honest one-liner. PROTOTYPE threshold on event count (a real version
  // would also weigh the time span).
  pulseHasSignal = computed(() => +this.issue().count >= 5);
}
