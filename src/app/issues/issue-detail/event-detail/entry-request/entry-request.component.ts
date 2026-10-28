import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
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
  formatBlock,
  formatValue,
  isHttpUrl,
  isLongValue,
  toggled,
} from "../event-format";

interface Section {
  key: string;
  label: string;
  summary: string;
  rows: PropertyRow[];
  /** Body: shown as an indented block instead of rows. */
  pre?: string;
  /** Body as JSON for Copy body. */
  copy?: string;
}

function pairs(value: unknown): PropertyRow[] {
  if (!value) return [];
  const list: [string, Json][] = Array.isArray(value)
    ? (value as [string, Json][])
    : Object.entries(value as { [k: string]: Json });
  return list.map(([key, v]) => {
    const text = formatValue(v);
    return { key, value: text, long: isLongValue(text) };
  });
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
  readonly opened = linkedSignal(() => {
    this.request();
    return new Set<string>();
  });

  readonly subtitle = computed(() => {
    const r = this.request();
    if (!r) return "";
    return [r.method, r.path].filter(Boolean).join(" ");
  });

  /** URL without the query string; the query is its own section. */
  readonly url = computed(() => this.request()?.url.split("?")[0] ?? "");

  readonly urlIsHttp = computed(() => isHttpUrl(this.request()?.url));

  readonly sections = computed<Section[]>(() => {
    const r = this.request();
    if (!r) return [];
    const out: Section[] = [];
    const query = pairs(r.query);
    if (query.length) {
      out.push({
        key: "query",
        label: $localize`Query`,
        summary: query.map((p) => `${p.key} ${p.value}`).join(" · "),
        rows: query,
      });
    }
    const body: unknown = r.data;
    if (body !== null && body !== undefined && body !== "") {
      const rows = typeof body === "object" ? pairs(body) : [];
      out.push({
        key: "body",
        label: $localize`Body`,
        summary: rows.length
          ? rows
              .map((p) =>
                p.value.startsWith("[") || p.value.startsWith("{")
                  ? p.key
                  : `${p.key} ${p.value}`,
              )
              .join(" · ")
          : String(body),
        rows: [],
        pre: formatBlock(body as Json),
        copy:
          typeof body === "object"
            ? JSON.stringify(body, null, 2)
            : String(body),
      });
    }
    for (const [key, label, value] of [
      ["headers", $localize`Headers`, r.headers],
      ["cookies", $localize`Cookies`, r.cookies],
      ["env", $localize`Environment`, r.env],
    ] as [string, string, unknown][]) {
      const rows = pairs(value);
      if (rows.length) {
        out.push({ key, label, summary: String(rows.length), rows });
      }
    }
    return out;
  });

  readonly raw = computed(() => {
    const r = this.request();
    if (!r) return "";
    let target = r.url;
    try {
      const u = new URL(r.url);
      target = u.pathname + u.search;
    } catch {
      // keep the raw url
    }
    const lines = [`${r.method ?? "GET"} ${target}`];
    for (const p of pairs(r.headers)) lines.push(`${p.key}: ${p.value}`);
    const cookies = pairs(r.cookies);
    if (cookies.length) {
      lines.push(
        "Cookie: " + cookies.map((c) => `${c.key}=${c.value}`).join("; "),
      );
    }
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

  toggle(key: string) {
    this.opened.set(toggled(this.opened(), key));
  }
}
