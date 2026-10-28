import { Route, UrlMatchResult, UrlSegment } from "@angular/router";
import { IssuesPage } from "./issues-page/issues-page";
import { IssueDetailComponent } from "./issue-detail/issue-detail.component";
import { CommentsComponent } from "./comments/comments.component";
import { EventDetailComponent } from "./issue-detail/event-detail/event-detail.component";
import { UserReportsIssueComponent } from "./user-reports-issue/user-reports-issue";
import { MergedComponent } from "./merged/merged.component";

/**
 * The latest event ("") and a picked one ("events/:event-id") are one route, so
 * stepping between them keeps the event view instead of swapping it.
 */
export function eventMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length === 0) return { consumed: [] };
  if (segments.length === 2 && segments[0].path === "events") {
    return { consumed: segments, posParams: { "event-id": segments[1] } };
  }
  return null;
}

export default [
  {
    path: "",
    component: IssuesPage,
  },
  {
    path: ":issue-id",
    component: IssueDetailComponent,
    resolve: [],
    children: [
      { matcher: eventMatcher, component: EventDetailComponent },
      { path: "comments", component: CommentsComponent },
      { path: "merged", component: MergedComponent },
      { path: "user-reports", component: UserReportsIssueComponent },
    ],
  },
] as Route[];
