import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  computed,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { IssueDetailService } from "../issue-detail.service";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatDividerModule } from "@angular/material/divider";
import { OrganizationsService } from "src/app/api/organizations.service";
import { IssueTagsAdjusted } from "../../interfaces";

@Component({
  selector: "gt-issue-detail-tags",
  templateUrl: "./issue-detail-tags.component.html",
  styleUrls: ["./issue-detail-tags.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDividerModule, MatTooltipModule, RouterModule],
})
export class IssueDetailTagsComponent implements OnInit {
  private issueService = inject(IssueDetailService);
  private organizationsService = inject(OrganizationsService);

  issueID = input.required<string>();
  orgSlug = computed(() => this.organizationsService.activeOrganization()?.slug);

  // Order by concentration: a tag where one value dominates the alternatives is
  // a lead ("this error is mostly on web-01"), so it rises. Single-value tags
  // carry no distribution signal (they're constant context, not a concentration),
  // so they sink to the bottom. Mirrors the "outliers first" pattern peer tools use.
  rankedTags = computed<IssueTagsAdjusted[] | null>(() => {
    const tags = this.issueService.tags();
    if (!tags) return null;
    const score = (t: IssueTagsAdjusted) =>
      t.uniqueValues > 1 ? (t.topValues[0]?.percent ?? 0) : -1;
    return [...tags].sort((a, b) => score(b) - score(a));
  });

  ngOnInit() {
    this.issueService.retrieveTags(+this.issueID());
  }

  /** Filter the issue stream by this tag value (clickable === filterable). */
  tagQuery(key: string, value: string): { [k: string]: string } {
    if (key === "environment") return { environment: value };
    return { query: `is:unresolved "${key}":"${value}"` };
  }
}
