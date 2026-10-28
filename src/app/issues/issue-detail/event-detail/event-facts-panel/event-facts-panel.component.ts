import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { OrganizationsService } from "src/app/api/organizations.service";
import { generateIconPath } from "src/app/shared/shared.utils";
import { IssueDetailService } from "../../issue-detail.service";
import { isSpreadTag, tagQuery } from "../../tag-filters";
import { isHttpUrl } from "../event-format";

interface Fact {
  label: string;
  value: string;
  share?: string;
  tooltip?: string;
  /** Scrolls to the Request panel. */
  request?: boolean;
  order?: number;
  /** 16px logo before the value (browser, OS, runtime, device, GPU). */
  icon?: string;
  /** Muted text after the value: a version, an arch, other user ids. */
  secondary?: string;
  /** Issue list filter for this value. */
  query?: { [key: string]: string };
  /** External link for a URL value. */
  href?: string;
}

/** A tag this event carries, shown as a tag chip in the Tags row. */
interface TagChip {
  key: string;
  value: string;
  share?: string;
  query: { [key: string]: string };
  href?: string;
  order: number;
}

type Context = { [key: string]: unknown } | null | undefined;

/** Which context describes a tag, for its logo and the details tags lack. */
const CONTEXT_OF: { [tag: string]: string } = {
  browser: "browser",
  "browser.name": "browser",
  "os.name": "os",
  os: "os",
  device: "device",
  runtime: "runtime",
  gpu: "gpu",
};

function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

/** The name a context's logo is looked up by (device: its model). */
function logoName(kind: string, ctx: Context): string {
  if (!ctx) return "";
  return kind === "device" ? str(ctx["model"]) : str(ctx["name"]);
}

function logo(name: string): string | undefined {
  return name ? generateIconPath(name) : undefined;
}

/** What a context adds to its fact: OS version or kernel, device arch, GPU vendor. */
function contextDetail(kind: string, ctx: Context, value: string): string {
  if (!ctx) return "";
  const first = (...keys: string[]) =>
    keys.map((k) => str(ctx[k])).find(Boolean) ?? "";
  let detail = "";
  if (kind === "os") detail = first("version", "kernel_version");
  if (kind === "device") detail = first("arch", "model_id");
  if (kind === "gpu") detail = first("vendor_name");
  return detail && !value.includes(detail) ? detail : "";
}

/** Known facts (environment, browser, OS, device...) before custom tags. */
function rank(key: string): number {
  const i = Object.keys(LABELS).indexOf(key);
  return i === -1 ? 100 : i;
}

const byRank = (a: { order?: number }, b: { order?: number }) =>
  (a.order ?? 100) - (b.order ?? 100);

/** Outliers first, then known tags before custom ones. */
const byShareThenRank = (a: TagChip, b: TagChip) =>
  Number(!!b.share) - Number(!!a.share) || byRank(a, b);

/** Tags that stay their own row: environment and the ones with a logo. */
function isFactTag(key: string): boolean {
  return key === "environment" || key in CONTEXT_OF;
}

const LABELS: { [key: string]: string } = {
  environment: $localize`Environment`,
  browser: $localize`Browser`,
  "os.name": $localize`OS`,
  os: $localize`OS`,
  device: $localize`Device`,
  runtime: $localize`Runtime`,
  gpu: $localize`GPU`,
  transaction: $localize`Transaction`,
  server_name: $localize`Server`,
  level: $localize`Level`,
  mechanism: $localize`Mechanism`,
  handled: $localize`Handled`,
};

const CAP = 6;

/**
 * This event: User, URL, Environment and the logo rows first, then the other
 * facts; every other tag is a chip in one Tags row, outliers first.
 */
@Component({
  selector: "gt-event-facts-panel",
  imports: [
    PanelComponent,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./event-facts-panel.component.html",
  styleUrl: "./event-facts-panel.component.scss",
})
export class EventFactsPanelComponent {
  private issueService = inject(IssueDetailService);
  readonly orgSlug = inject(OrganizationsService).activeOrganizationSlug;
  readonly showRequest = output<void>();
  readonly expanded = signal(false);
  readonly cap = CAP;
  readonly subtitle = $localize`outliers show their share`;
  readonly filterTip = $localize`Show issues with this value`;

  /** "2 of 15" when the value is not the issue's most common one. */
  private share(key: string, value: string): string | undefined {
    const tag = this.issueService.tags()?.find((t) => t.key === key);
    if (!tag || tag.uniqueValues <= 1) return undefined;
    const top = tag.topValues[0];
    const mine = tag.topValues.find((v) => v.value === value);
    if (!mine || mine.value === top?.value) return undefined;
    return $localize`${mine.count} of ${tag.totalValues}`;
  }

  /** This event's tags that are not their own fact row. */
  readonly chips = computed<TagChip[]>(() => {
    const event = this.issueService.event();
    if (!event) return [];
    const tags = event.tags ?? [];
    const keys = tags.map((t) => t.key ?? "");
    const requestUrl = this.issueService.eventEntryRequest()?.url;
    const chips: TagChip[] = [];
    for (const t of tags) {
      if (!t.key || t.value === null || t.value === undefined) continue;
      if (isFactTag(t.key) || !isSpreadTag(t.key, keys)) continue;
      if (t.key === "url" && requestUrl) continue;
      const value = String(t.value);
      chips.push({
        key: t.key,
        value,
        share: this.share(t.key, value),
        query: tagQuery(t.key, value),
        href: isHttpUrl(value) ? value : undefined,
        order: rank(t.key),
      });
    }
    return chips.sort(byShareThenRank);
  });

  readonly facts = computed<Fact[]>(() => {
    const event = this.issueService.event();
    if (!event) return [];
    const lead: Fact[] = [];
    const outliers: Fact[] = [];
    const rest: Fact[] = [];
    const tags = event.tags ?? [];
    const contexts = (event.contexts ?? {}) as { [key: string]: Context };
    const contextFor = (kind: string): Context =>
      contexts[kind] ?? (kind === "os" ? contexts["client_os"] : undefined);

    const user = event.user as { [key: string]: any } | null;
    if (user) {
      const value =
        user["email"] || user["username"] || user["id"] || user["ip_address"];
      if (value) {
        const key = user["email"]
          ? "user.email"
          : user["username"]
            ? "user.username"
            : user["id"]
              ? "user.id"
              : "user.ip";
        const others = [user["id"], user["username"]]
          .map((v) => str(v))
          .filter((v) => v && v !== String(value));
        lead.push({
          label: $localize`User`,
          value: String(value),
          secondary: [...new Set(others)].join(" · "),
          share: this.share(key, String(value)),
          // Filterable only when the event carries it as a tag.
          query: (event.tags ?? []).some(
            (t) => t.key === key && String(t.value) === String(value),
          )
            ? tagQuery(key, String(value))
            : undefined,
        });
      }
    }

    const request = this.issueService.eventEntryRequest();
    if (request?.url) {
      let path = request.url;
      try {
        path = new URL(request.url).pathname;
      } catch {
        // keep the raw url
      }
      lead.push({
        label: $localize`URL`,
        value: [request.method, path].filter(Boolean).join(" "),
        request: true,
        href: isHttpUrl(request.url) ? request.url : undefined,
      });
    }

    const keys = tags.map((t) => t.key ?? "");
    const kindsWithTag = new Set<string>();
    for (const t of tags) {
      if (!t.key || t.value === null || t.value === undefined) continue;
      const tag = { key: t.key, value: String(t.value) };
      const kind = CONTEXT_OF[tag.key];
      if (kind) kindsWithTag.add(kind);
      if (!isSpreadTag(tag.key, keys) || !isFactTag(tag.key)) continue;
      if (tag.key === "url" && request?.url) continue;
      const share = this.share(tag.key, tag.value);
      const ctx = kind ? contextFor(kind) : undefined;
      const fact: Fact = {
        label: LABELS[tag.key] ?? tag.key,
        value: tag.value,
        share,
        query: tagQuery(tag.key, tag.value),
        href: isHttpUrl(tag.value) ? tag.value : undefined,
        icon: kind
          ? logo(logoName(kind, ctx)) || logo(tag.value.trim())
          : undefined,
        secondary: kind ? contextDetail(kind, ctx, tag.value) : undefined,
      };
      (share ? outliers : rest).push({ ...fact, order: rank(tag.key) });
    }

    // Contexts no tag covers: runtime, GPU, device, OS, browser.
    for (const [kind, label] of [
      ["browser", LABELS["browser"]],
      ["os", LABELS["os"]],
      ["device", LABELS["device"]],
      ["runtime", LABELS["runtime"]],
      ["gpu", LABELS["gpu"]],
    ]) {
      if (kindsWithTag.has(kind)) continue;
      const ctx = contextFor(kind);
      const name = logoName(kind, ctx);
      if (!ctx || !name || name === "Other") continue;
      // A browser's runtime is the browser, already listed.
      if (kind === "runtime" && name.toLowerCase() === "browser") continue;
      const version = kind === "device" ? "" : str(ctx["version"]);
      const value = [name, kind === "os" ? "" : version]
        .filter(Boolean)
        .join(" ");
      rest.push({
        label,
        value,
        icon: logo(name),
        secondary: contextDetail(kind, ctx, value),
        order: rank(kind),
      });
    }

    if (user) {
      const geo = user["geo"] as { [key: string]: string } | undefined;
      const place = geo
        ? [geo["city"], geo["region"], geo["country_code"]]
            .filter(Boolean)
            .join(", ")
        : "";
      const where = [place, user["ip_address"]].filter(Boolean).join(" · ");
      if (where) rest.push({ label: $localize`Location`, value: where });
    }

    const trace = contexts["trace"] as { [key: string]: any } | undefined;
    if (trace?.["trace_id"]) {
      rest.push({
        label: $localize`Trace`,
        value: String(trace["trace_id"]).slice(0, 8),
        tooltip: [trace["trace_id"], trace["op"], trace["status"]]
          .filter(Boolean)
          .join(" · "),
      });
    }

    if (event.dateCreated && event.dateReceived) {
      const sent = new Date(event.dateCreated);
      const received = new Date(event.dateReceived);
      if (Math.abs(received.getTime() - sent.getTime()) > 60_000) {
        const fmt = (d: Date) =>
          d.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        rest.push({
          label: $localize`Sent`,
          value: fmt(sent),
          tooltip: $localize`Client time. Received ${fmt(received)}`,
        });
      }
    }

    return [...lead, ...outliers.sort(byRank), ...rest.sort(byRank)];
  });

  readonly hasShares = computed(
    () =>
      this.facts().some((f) => f.share) || this.chips().some((c) => c.share),
  );

  readonly shown = computed(() =>
    this.expanded() ? this.facts() : this.facts().slice(0, CAP),
  );
}
