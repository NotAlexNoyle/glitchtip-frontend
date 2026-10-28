import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  output,
  signal,
} from "@angular/core";
import { formatDate } from "@angular/common";
import { Params, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { OrganizationsService } from "src/app/api/organizations.service";
import { generateIconPath } from "src/app/shared/shared.utils";
import { IssueDetailService } from "../../issue-detail.service";
import { injectTagFilter, isSpreadTag } from "../../tag-filters";
import {
  CONTEXT_OF,
  EventContexts,
  arrivedLate,
  contextDetail,
  contextFact,
  contextFor,
  contextName,
  eventUser,
  isHttpUrl,
  traceSummary,
  userLocation,
} from "../event-format";

interface Fact {
  label: string;
  value: string;
  tooltip?: string;
  /** Scrolls to the Request panel. */
  request?: boolean;
  order?: number;
  /** 16px logo before the value (browser, OS, runtime, device, GPU). */
  icon?: string;
  /** Muted text after the value: a version, an arch, other user ids. */
  secondary?: string;
  /** Issue list filter for this value. */
  query?: Params;
  /** External link for a URL value. */
  href?: string;
}

/** A tag this event carries, shown as a tag chip in the Tags row. */
interface TagChip {
  key: string;
  value: string;
  query: Params;
  href?: string;
  order: number;
}

function logo(name: string): string | undefined {
  return name ? generateIconPath(name) : undefined;
}

/** Known facts (environment, browser, OS, device...) before custom tags. */
function rank(key: string): number {
  const i = Object.keys(LABELS).indexOf(key);
  return i === -1 ? 100 : i;
}

const byRank = (a: { order?: number }, b: { order?: number }) =>
  (a.order ?? 100) - (b.order ?? 100);

/** Tags that stay their own row: environment, release and the logo rows. */
function isFactTag(key: string, keys: string[]): boolean {
  if (key === "environment" || key === "release") return true;
  return key in CONTEXT_OF && isSpreadTag(key, keys);
}

const LABELS: { [key: string]: string } = {
  environment: $localize`Environment`,
  release: $localize`Release`,
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

/** Time sorts after the tag and context facts, before custom tags. */
const TIME_ORDER = 50;

/**
 * This event: User, URL, Environment and the logo rows first, then the other
 * facts; every other tag is a chip in one Tags row.
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
  private locale = inject(LOCALE_ID);
  readonly orgSlug = inject(OrganizationsService).activeOrganizationSlug;
  private readonly tagFilter = injectTagFilter();
  readonly showRequest = output<void>();
  readonly expanded = signal(false);
  readonly cap = CAP;
  readonly filterTip = $localize`Show issues with this value`;

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
      if (isFactTag(t.key, keys) || !isSpreadTag(t.key, keys)) continue;
      if (t.key === "url" && requestUrl) continue;
      const value = String(t.value);
      chips.push({
        key: t.key,
        value,
        query: this.tagFilter(t.key, value),
        href: isHttpUrl(value) ? value : undefined,
        order: rank(t.key),
      });
    }
    return chips.sort(byRank);
  });

  readonly facts = computed<Fact[]>(() => {
    const event = this.issueService.event();
    if (!event) return [];
    const lead: Fact[] = [];
    const rest: Fact[] = [];
    const tags = event.tags ?? [];
    const contexts = (event.contexts ?? {}) as EventContexts;

    const user = event.user as { [key: string]: unknown } | null;
    const who = eventUser(user);
    if (who) {
      lead.push({
        label: $localize`User`,
        value: who.value,
        secondary: who.others.join(" · "),
        // Filterable only when the event carries it as a tag.
        query: tags.some((t) => t.key === who.key && t.value === who.value)
          ? this.tagFilter(who.key, who.value)
          : undefined,
      });
    }

    const request = this.issueService.eventEntryRequest();
    if (request?.url) {
      lead.push({
        label: $localize`URL`,
        value: [request.method, request.path].filter(Boolean).join(" "),
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
      if (!isFactTag(tag.key, keys)) continue;
      if (tag.key === "url" && request?.url) continue;
      const ctx = kind ? contextFor(contexts, kind) : undefined;
      const fact: Fact = {
        label: LABELS[tag.key] ?? tag.key,
        value: tag.value,
        query: this.tagFilter(tag.key, tag.value),
        href: isHttpUrl(tag.value) ? tag.value : undefined,
        icon: kind
          ? logo(contextName(kind, ctx)) || logo(tag.value.trim())
          : undefined,
        secondary: kind ? contextDetail(kind, ctx, tag.value) : undefined,
      };
      rest.push({ ...fact, order: rank(tag.key) });
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
      const fact = contextFact(kind, contextFor(contexts, kind));
      if (!fact) continue;
      rest.push({
        label,
        value: fact.value,
        icon: logo(fact.name),
        secondary: fact.detail,
        order: rank(kind),
      });
    }

    const where = userLocation(user);
    if (where) rest.push({ label: $localize`Location`, value: where });

    const trace = traceSummary(contexts["trace"]);
    if (trace) {
      rest.push({
        label: $localize`Trace`,
        value: trace.short,
        tooltip: trace.full,
      });
    }

    // Absolute time, also for the latest event; the tip notes a late arrival.
    if (event.dateCreated) {
      const fmt = (d: string) => formatDate(d, "medium", this.locale);
      rest.push({
        label: $localize`Time`,
        value: fmt(event.dateCreated),
        tooltip: arrivedLate(event.dateCreated, event.dateReceived)
          ? $localize`Client time. Received ${fmt(event.dateReceived)}:received:`
          : undefined,
        order: TIME_ORDER,
      });
    }

    return [...lead, ...rest.sort(byRank)];
  });

  readonly shown = computed(() =>
    this.expanded() ? this.facts() : this.facts().slice(0, CAP),
  );
}
