import { Component, ChangeDetectionStrategy, computed, input } from "@angular/core";
import { TitleCasePipe } from "@angular/common";
import { MatIconModule } from "@angular/material/icon";
import { DetailMastheadComponent } from "src/app/shared/detail/masthead/detail-masthead.component";
import { StatComponent } from "src/app/shared/stat/stat.component";
import { TimestampComponent } from "src/app/shared/object-attributes/timestamp.component";
import { IssuePulse } from "../issue-pulse/issue-pulse";
import { components } from "src/app/api/api-schema";
import {
  issueLevelToken,
  issueName,
  issueStatusToken,
} from "src/app/shared/object-identity/object-identity";

type IssueDetail = components["schemas"]["IssueDetailSchema"];

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
    TimestampComponent,
    TitleCasePipe,
    MatIconModule,
  ],
  templateUrl: "./issue-masthead.html",
  styleUrl: "./issue-masthead.scss",
})
export class IssueMasthead {
  readonly issue = input.required<IssueDetail>();

  // Identity now comes from the shared object-identity tokens, so the masthead
  // names, colours, and badges an issue exactly as the list row and any nested
  // reference do.
  levelToken = computed(() => issueLevelToken(this.issue().level));
  statusIcon = computed(() => issueStatusToken(this.issue().status).icon);
  // Accessible name for the status indicator: the glyph + level are otherwise
  // colour-only. e.g. "Unresolved, Error level".
  statusAriaLabel = computed(
    () =>
      `${issueStatusToken(this.issue().status).label}, ${this.levelToken().label} level`,
  );

  #name = computed(() => issueName(this.issue()));
  issueTitle = computed<[string, string | null]>(() => {
    const name = this.#name();
    return [name.title, name.suffix];
  });
  issueSubtitle = computed(() => this.#name().subtitle);

  // The pulse only earns its space when there's a trend to read; below this we
  // show an honest one-liner. PROTOTYPE threshold on event count (a real version
  // would also weigh the time span).
  pulseHasSignal = computed(() => +this.issue().count >= 5);
}
