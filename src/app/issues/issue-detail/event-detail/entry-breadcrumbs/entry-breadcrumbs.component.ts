import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { MatSelectModule } from "@angular/material/select";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { SelectGhostDirective } from "src/app/shared/select-ghost.directive";
import { IssueDetailService } from "../../issue-detail.service";
import { Breadcrumb } from "../../../interfaces";
import { PropertyRow, crumbSummary, hasRows, toRows } from "../event-format";
import { openKeys } from "src/app/shared/signal.utils";

/** Breadcrumbs shown before "Show N earlier", never for just one. */
const RECENT = 5;

interface CrumbRow {
  key: string;
  time: string;
  short: string;
  level: string;
  levelClass: string;
  tone: "error" | "warning" | "";
  category: string;
  /** Neutral glyph for the category. */
  icon: string;
  message: string;
  /** Too long for its one line; opening the row shows it in full. */
  long: boolean;
  expandable: boolean;
  crumb: Breadcrumb;
}

/** Messages longer than this open in full. */
const LONG_MESSAGE = 80;

/** Level words for the levels the list marks; the rest stay blank. */
const LEVELS: { [level: string]: string } = {
  warning: $localize`Warning`,
  error: $localize`Error`,
  fatal: $localize`Fatal`,
};

/** Glyphs for clicks, network requests and the rest. */
function crumbIcon(category: string | null | undefined): string {
  if (category === "ui.click") return "person";
  if (
    category === "xhr" ||
    category === "fetch" ||
    category === "http" ||
    category === "httplib"
  ) {
    return "cloud";
  }
  return "code";
}

function clock(iso: string | null | undefined): {
  time: string;
  short: string;
} {
  // new Date(null) is 1970, not "no time".
  if (!iso) return { time: "", short: "" };
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { time: iso, short: iso };
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const short = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return { time: `${short}.${pad(d.getMilliseconds(), 3)}`, short };
}

@Component({
  selector: "gt-entry-breadcrumbs",
  templateUrl: "./entry-breadcrumbs.component.html",
  styleUrls: ["./entry-breadcrumbs.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PanelComponent,
    SelectGhostDirective,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgTemplateOutlet,
  ],
})
export class EntryBreadcrumbsComponent {
  private issueService = inject(IssueDetailService);

  private readonly crumbs = computed(
    () => this.issueService.breadcrumbs()?.values ?? [],
  );
  readonly total = computed(() => this.crumbs().length);
  readonly subtitle = computed(() => String(this.total()));

  /** Selected categories; none selected shows them all. */
  readonly category = linkedSignal<string[]>(() => {
    this.crumbs();
    return [];
  });
  readonly showEarlier = linkedSignal(() => {
    this.crumbs();
    return false;
  });
  readonly opened = openKeys(this.crumbs);

  readonly categories = computed(() =>
    [
      ...new Set(
        this.crumbs()
          .map((c) => c.category)
          .filter(Boolean),
      ),
    ].sort(),
  );

  readonly categoryLabel = computed(() => {
    const picked = this.category();
    if (!picked.length) return $localize`All`;
    if (picked.length === 1) return picked[0];
    return $localize`${picked.length}:count: selected`;
  });

  private readonly filtered = computed<CrumbRow[]>(() => {
    const picked = new Set(this.category());
    return this.crumbs()
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !picked.size || picked.has(c.category))
      .map(({ c, i }) => {
        const level = Object.hasOwn(LEVELS, c.level) ? c.level : "";
        const message = crumbSummary(c);
        const long = message.length > LONG_MESSAGE || message.includes("\n");
        const hasData = hasRows(c.data);
        return {
          key: `b${i}`,
          ...clock(c.timestamp),
          level: level ? LEVELS[level] : "",
          levelClass: level ? `crumbs__level-bar level--${level}` : "",
          tone: level === "warning" ? "warning" : level ? "error" : "",
          category: c.category || c.type,
          icon: crumbIcon(c.category),
          message,
          long,
          expandable: long || hasData,
          crumb: c,
        };
      });
  });

  readonly hiddenCount = computed(() => {
    const hidden = this.filtered().length - RECENT;
    return this.showEarlier() || hidden < 2 ? 0 : hidden;
  });

  readonly rows = computed(() => {
    const rows = this.filtered();
    return this.hiddenCount() ? rows.slice(-RECENT) : rows;
  });

  /** Data rows, formatted only for the crumbs that are open. */
  readonly openedData = computed(() => {
    const opened = this.opened();
    const data = new Map<string, PropertyRow[]>();
    for (const row of this.rows()) {
      if (opened.has(row.key) && hasRows(row.crumb.data)) {
        data.set(row.key, toRows(row.crumb.data));
      }
    }
    return data;
  });

  /** The marker row the UI adds where the event happened. */
  readonly eventRow = computed(() => {
    const event = this.issueService.event();
    if (!event?.dateCreated) return null;
    return { ...clock(event.dateCreated), message: event.title || "" };
  });
}
