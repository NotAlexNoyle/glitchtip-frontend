import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import { ClipboardModule } from "@angular/cdk/clipboard";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTooltipModule } from "@angular/material/tooltip";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import {
  GhostSelectComponent,
  GhostSelectOption,
} from "src/app/shared/ghost-select/ghost-select.component";
import { IssueDetailService } from "../../issue-detail.service";
import { Json } from "src/app/interface-primitives";
import {
  PropertyRow,
  cookiePairs,
  cookieRows,
  formatBlock,
  isHttpUrl,
  summarize,
  toRows,
} from "../event-format";
import { openKeys } from "src/app/shared/signal.utils";

interface Section {
  key: string;
  label: string;
  /** Rows inside, shown by the label. */
  count: number | null;
  summary: string;
  rows: PropertyRow[];
  /** Body: shown as an indented block instead of rows. */
  pre?: string;
  /** Body as JSON for Copy body. */
  copy?: string;
}

@Component({
  selector: "gt-entry-request",
  templateUrl: "./entry-request.component.html",
  styleUrls: ["./entry-request.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PanelComponent,
    GhostSelectComponent,
    ClipboardModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  host: { id: "request" },
})
export class EntryRequestComponent {
  private issueService = inject(IssueDetailService);
  private snackBar = inject(MatSnackBar);

  request = this.issueService.eventEntryRequest;
  readonly formats: GhostSelectOption[] = [
    { value: "formatted", label: $localize`Formatted` },
    { value: "raw", label: $localize`Raw` },
  ];
  readonly format = signal("formatted");
  readonly opened = openKeys(this.request);

  readonly subtitle = computed(() => {
    const r = this.request();
    if (!r) return "";
    return [r.method, r.path].filter(Boolean).join(" ");
  });

  /** URL without the query string; the query is its own section. */
  readonly url = computed(() => this.request()?.url?.split("?")[0] ?? "");

  readonly urlIsHttp = computed(() => isHttpUrl(this.request()?.url));

  readonly sections = computed<Section[]>(() => {
    const r = this.request();
    if (!r) return [];
    const out: Section[] = [];
    const rowSection = (key: string, label: string, value: unknown) => {
      const rows = toRows(value);
      if (rows.length) {
        out.push({
          key,
          label,
          count: rows.length,
          summary: summarize(value),
          rows,
        });
      }
    };
    rowSection("query", $localize`Query`, r.query);
    const body: unknown = r.data;
    const summary = summarize(body);
    // An empty object, array or string has nothing to show.
    if (summary) {
      out.push({
        key: "body",
        label: $localize`Body`,
        count: null,
        summary,
        rows: [],
        pre: formatBlock(body as Json),
        copy:
          typeof body === "object"
            ? JSON.stringify(body, null, 2)
            : String(body),
      });
    }
    rowSection("headers", $localize`Headers`, r.headers);
    rowSection("cookies", $localize`Cookies`, cookiePairs(r.cookies));
    rowSection("env", $localize`Environment`, r.env);
    return out;
  });

  /** A request with no URL and no sections has nothing to show. */
  readonly hasContent = computed(
    () => !!this.url() || this.sections().length > 0,
  );

  readonly raw = computed(() => {
    const r = this.request();
    if (!r) return "";
    let target = r.url ?? "";
    try {
      const u = new URL(target);
      target = u.pathname + u.search;
    } catch {
      // Not an absolute URL: shown as sent.
    }
    // SDKs may send the query apart from the URL.
    const query = toRows(r.query)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
    if (query && !target.includes("?")) target += `?${query}`;
    const lines = [[r.method ?? "GET", target].filter(Boolean).join(" ")];
    for (const p of toRows(r.headers)) lines.push(`${p.key}: ${p.value}`);
    // A header string is shown as sent; pairs and objects are joined into one.
    const cookies =
      typeof r.cookies === "string"
        ? r.cookies.trim()
        : cookieRows(r.cookies)
            .map((c) => `${c.key}=${c.value}`)
            .join("; ");
    if (cookies) lines.push(`Cookie: ${cookies}`);
    const body: unknown = r.data;
    if (body) {
      lines.push(
        "",
        typeof body === "object" ? JSON.stringify(body, null, 2) : String(body),
      );
    }
    return lines.join("\n");
  });

  onCopiedBody() {
    this.snackBar.open($localize`Body copied`);
  }
}
