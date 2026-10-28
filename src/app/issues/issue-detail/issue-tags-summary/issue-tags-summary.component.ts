import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from "@angular/core";
import { Params, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { OrganizationsService } from "src/app/api/organizations.service";
import { IssueTagsAdjusted } from "../../interfaces";
import { IssueDetailService } from "../issue-detail.service";
import { toggled } from "../event-detail/event-format";
import { injectTagFilter, isSpreadTag, isUserTag } from "../tag-filters";

/** The user tag the full ranking shows: the most readable one present. */
const USER_DISPLAY_KEYS = ["user.email", "user.username", "user.id", "user.ip"];

/** The one user tag the summary line may show, most readable first. */
const LINE_USER_KEYS = ["user.email", "user.username", "user.id"];

/** A user tag joins the line only when one user has this share (percent). */
const USER_CONCENTRATION_MIN = 50;

/** Chips on the line before All tags. */
const TOP = 4;

/** The ranking also splits by release and by one user tag. */
function isRankedTag(key: string, keys: string[]): boolean {
  if (key === "release") return true;
  if (isUserTag(key)) {
    return key === USER_DISPLAY_KEYS.find((k) => keys.includes(k));
  }
  return isSpreadTag(key, keys);
}

interface TagValue {
  value: string;
  percent: number;
  query: Params;
  tip: string;
}

interface RankedTag {
  key: string;
  top: TagValue;
  values: TagValue[];
  other: number;
}

let nextId = 0;

/**
 * The issue zone's Tags line: the most concentrated values as chips that
 * filter, and All tags to open the full ranking inline.
 */
@Component({
  selector: "gt-issue-tags-summary",
  imports: [
    PanelComponent,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./issue-tags-summary.component.html",
  styleUrl: "./issue-tags-summary.component.scss",
})
export class IssueTagsSummaryComponent {
  private issueService = inject(IssueDetailService);
  readonly orgSlug = inject(OrganizationsService).activeOrganizationSlug;
  private readonly tagFilter = injectTagFilter();

  readonly open = signal(false);
  readonly panelId = `gt-issue-tags-${nextId++}`;
  readonly opened = linkedSignal(() => {
    this.issueService.tags();
    return new Set<string>();
  });

  private readonly tags = computed(() => {
    const tags = this.issueService.tags() ?? [];
    const keys = tags.map((t) => t.key);
    return tags.filter((t) => t.topValues.length && isRankedTag(t.key, keys));
  });

  private readonly varied = computed(() =>
    this.tags().filter((t) => t.uniqueValues > 1),
  );

  /** Most concentrated first; when no tag varies, every tag is a row. */
  readonly ranked = computed<RankedTag[]>(() =>
    [...(this.varied().length ? this.varied() : this.tags())]
      .sort(
        (a, b) =>
          (b.topValues[0]?.percent ?? 0) - (a.topValues[0]?.percent ?? 0),
      )
      .map((t) => this.toRanked(t)),
  );

  /** Tags with one value on every event, listed once in the end row. */
  readonly same = computed(() =>
    this.varied().length
      ? this.tags()
          .filter((t) => t.uniqueValues <= 1)
          .map((t) => {
            const value = t.topValues[0].value;
            return { key: t.key, value, query: this.tagFilter(t.key, value) };
          })
      : [],
  );

  /** At most one user tag, and only when one user dominates. */
  readonly top = computed(() => {
    const ranked = this.ranked();
    const userKey = LINE_USER_KEYS.find((k) => ranked.some((t) => t.key === k));
    return ranked
      .filter(
        (t) =>
          !isUserTag(t.key) ||
          (t.key === userKey && t.top.percent >= USER_CONCENTRATION_MIN),
      )
      .slice(0, TOP)
      .map((t) => ({ ...t, tip: `${t.key}: ${t.top.tip}` }));
  });

  readonly tagged = computed(() =>
    Math.max(0, ...this.tags().map((t) => t.totalValues)),
  );

  toggle(key: string) {
    this.opened.set(toggled(this.opened(), key));
  }

  private toRanked(tag: IssueTagsAdjusted): RankedTag {
    const values = tag.topValues.map((v) => ({
      value: v.value,
      percent: v.percentRounded,
      query: this.tagFilter(tag.key, v.value),
      tip: $localize`${v.count}:count: of ${tag.totalValues}:total:`,
    }));
    return { key: tag.key, top: values[0], values, other: tag.other ?? 0 };
  }
}
