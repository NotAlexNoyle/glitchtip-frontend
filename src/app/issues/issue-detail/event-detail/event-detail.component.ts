import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  computed,
  effect,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
  Injector,
} from "@angular/core";
import { OverlayContainer } from "@angular/cdk/overlay";
import { Router, RouterLink } from "@angular/router";
import { Clipboard, ClipboardModule } from "@angular/cdk/clipboard";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatDialog } from "@angular/material/dialog";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatSelect, MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { DatePipe, DecimalPipe } from "@angular/common";
import { IssueDetailService, RecentEvent } from "../issue-detail.service";
import { SettingsService } from "src/app/api/settings.service";
import { DaysAgoPipe } from "src/app/shared/days-ago.pipe";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { EmptyStateComponent } from "src/app/shared/empty-state/empty-state.component";
import { SplitButtonComponent } from "src/app/shared/split-button/split-button.component";
import { SelectGhostDirective } from "src/app/shared/select-ghost.directive";
import { EntryRequestComponent } from "./entry-request/entry-request.component";
import { EntryBreadcrumbsComponent } from "./entry-breadcrumbs/entry-breadcrumbs.component";
import { EntryCSPComponent } from "./entry-csp/entry-csp.component";
import { EntryExceptionComponent } from "./entry-exception/entry-exception.component";
import { EntryMessageComponent } from "./entry-message/entry-message.component";
import { EventFactsPanelComponent } from "./event-facts-panel/event-facts-panel.component";
import { EventMoreDataComponent } from "./event-more-data/event-more-data.component";

/** The switcher option that loads the next page of events. */
const SHOW_MORE = "__more";

interface EventOption {
  id: string;
  short: string;
  date: string;
  /** Muted second line: environment, release, user. */
  details: string;
  latest: boolean;
}

type EventTags = { key?: string | null; value?: string | null }[] | null;

function tagOf(tags: EventTags | undefined, key: string) {
  return tags?.find((t) => t.key === key)?.value ?? null;
}

function userOf(user: unknown, tags: EventTags | undefined) {
  const u = (user ?? {}) as Record<string, unknown>;
  const name = u["email"] || u["username"] || u["id"] || u["ip_address"];
  if (typeof name === "string" || typeof name === "number") return String(name);
  const tag = tagOf(tags, "user");
  return tag ? tag.replace(/^(id|email|username|ip):/, "") : null;
}

function toOption(e: RecentEvent, latest: boolean): EventOption {
  const details = [
    tagOf(e.tags, "environment"),
    tagOf(e.tags, "release"),
    userOf(e.user, e.tags),
  ].filter((v): v is string => !!v);
  return {
    id: e.id,
    short: e.eventID.slice(0, 8),
    date: e.dateCreated,
    details: details.join(" · "),
    latest,
  };
}

/** localStorage flag: the one-time "connect your agent via MCP" tip has been shown. */
const MCP_COPY_HINT_SEEN_KEY = "mcpCopyHintSeen";

function readHintSeen(): boolean {
  try {
    return localStorage.getItem(MCP_COPY_HINT_SEEN_KEY) === "true";
  } catch {
    return false;
  }
}

@Component({
  selector: "gt-event-detail",
  templateUrl: "./event-detail.component.html",
  styleUrls: ["./event-detail.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "(document:keydown)": "onKeydown($event)" },
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatSelectModule,
    RouterLink,
    ClipboardModule,
    EntryMessageComponent,
    EntryExceptionComponent,
    EntryCSPComponent,
    EntryBreadcrumbsComponent,
    EntryRequestComponent,
    EventFactsPanelComponent,
    EventMoreDataComponent,
    DatePipe,
    DecimalPipe,
    DaysAgoPipe,
    PanelComponent,
    EmptyStateComponent,
    SplitButtonComponent,
    SelectGhostDirective,
  ],
})
export class EventDetailComponent {
  private issueService = inject(IssueDetailService);
  private settingsService = inject(SettingsService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private clipboard = inject(Clipboard);
  private dialog = inject(MatDialog);
  private overlay = inject(OverlayContainer);
  private injector = inject(Injector);
  orgSlug = input.required<string>({ alias: "org-slug" });
  issueID = input.required<string>({ alias: "issue-id" });
  eventID = input<string | null>(null, { alias: "event-id" });

  event = this.issueService.event;

  /**
   * Whether the MCP feature is available on this instance. Gates the post-copy
   * hint ONLY — the "copy for AI" button works regardless. Reuses the already
   * loaded settings, no extra fetch.
   */
  mcpEnabled = computed(() =>
    this.settingsService.enabledFeatures().includes("mcp"),
  );

  /** Frontend-only dismiss flag for the one-time MCP hint. */
  private mcpHintSeen = signal(readHintSeen());

  /**
   * The event as a payload tuned for pasting into an LLM agent: a marker that
   * this is a GlitchTip error event, the identifiers shown on the page, the
   * instance origin and a link back to this event, then the raw event JSON.
   *
   * Light metadata only — deliberately NO pre-written prompt/ask. The added
   * context makes the plain paste-into-a-chatbot path work better on its own.
   */
  aiPayload = computed(() => {
    const event = this.event();
    if (!event) {
      return "";
    }
    const origin = window.location.origin;
    const lines = [
      "GlitchTip error event",
      `Source: ${this.settingsService.instanceName() || origin}`,
      `Instance: ${origin}`,
      `Organization: ${this.orgSlug()}`,
      `Issue ID: ${this.issueID()}`,
      `Event ID: ${event.id}`,
      `Event URL: ${window.location.href}`,
      "",
      "Raw event JSON:",
      "```json",
      JSON.stringify(event, null, 2),
      "```",
    ];
    return lines.join("\n");
  });

  environment = computed(() => tagOf(this.event()?.tags, "environment"));
  release = computed(() => tagOf(this.event()?.tags, "release"));
  /** The header already shows the first seen release. */
  showRelease = computed(() => {
    const release = this.release();
    const first = this.issueService.issue()?.firstRelease;
    return (
      !!release && release !== first?.version && release !== first?.shortVersion
    );
  });
  latestUrl = computed(() => `/${this.orgSlug()}/issues/${this.issueID()}`);
  rawJsonUrl = computed(() => {
    const event = this.event();
    if (!event) return "";
    return `/organizations/${this.orgSlug()}/issues/${event.groupID}/events/${event.id}/json/`;
  });
  eventLink = computed(() => {
    const event = this.event();
    if (!event) return "";
    return `${window.location.origin}/${this.orgSlug()}/issues/${this.issueID()}/events/${event.id}`;
  });
  trace = this.issueService.exceptionTrace;
  readonly eventNotFoundMessage = $localize`This may be because the URL is pointing to an event that doesn't exist or was deleted.`;
  initialLoadComplete = this.issueService.eventInitialLoadComplete;
  nextEvent = this.issueService.hasNextEvent;
  previousEvent = this.issueService.hasPreviousEvent;
  nextEventUrl = this.issueService.nextEventUrl;
  previousEventUrl = this.issueService.previousEventUrl;

  eventCount = computed(() => +(this.issueService.issue()?.count ?? 0));
  readonly showMoreValue = SHOW_MORE;
  private recent = computed(() => {
    const r = this.issueService.recentEvents();
    return r && r.issueID === this.issueID() ? r : null;
  });
  recentLoading = computed(() => !!this.recent()?.loading);
  recentFailed = computed(() => !!this.recent()?.failed);
  hasMoreEvents = computed(() => !!this.recent()?.cursor);
  /** Newest first; the current event is always an option, last if older. */
  switcherOptions = computed<EventOption[]>(() => {
    const event = this.event();
    if (!event) return [];
    const options = (this.recent()?.events ?? []).map((e, i) =>
      toOption(e, i === 0),
    );
    if (!options.some((o) => o.id === event.id)) {
      options.push(toOption(event, this.nextEvent() === false));
    }
    return options;
  });

  private readonly zoneBody = viewChild<ElementRef<HTMLElement>>("zoneBody");
  /** The event on screen, to tell a step to another event from a reload. */
  private shown: { issueID: string; eventID: string } | null = null;

  /** True while the event bar is stuck to the top of the scroll area. */
  readonly stuck = signal(false);
  private readonly sentinel = viewChild<ElementRef<HTMLElement>>("barSentinel");

  constructor() {
    effect(() => {
      this.issueService.eventID.set(this.eventID());
    });
    // The sentinel marks the zone's top: once it scrolls out, the bar is stuck.
    effect((onCleanup) => {
      const el = this.sentinel()?.nativeElement;
      if (!el) return;
      const observer = new IntersectionObserver(([entry]) =>
        this.stuck.set(
          !entry.isIntersecting && entry.boundingClientRect.top < 0,
        ),
      );
      observer.observe(el);
      onCleanup(() => observer.disconnect());
    });
    effect(() => {
      const event = this.event();
      if (!event) return;
      const issueID = this.issueID();
      const prev = this.shown;
      this.shown = { issueID, eventID: event.eventID };
      if (prev && prev.issueID === issueID && prev.eventID !== event.eventID) {
        this.tintZone();
      }
    });
  }

  /** [ and ] step to the older and newer event, outside fields and overlays. */
  onKeydown(e: KeyboardEvent) {
    if (e.key !== "[" && e.key !== "]") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (this.dialog.openDialogs.length) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        target.closest("mat-select") ||
        this.overlay.getContainerElement().contains(target))
    ) {
      return;
    }
    const url = e.key === "[" ? this.previousEventUrl() : this.nextEventUrl();
    if (url) {
      e.preventDefault();
      this.router.navigateByUrl(url);
    }
  }

  onSwitcherOpened(open: boolean) {
    if (open) {
      this.issueService.loadRecentEvents();
    }
  }

  async onPickEvent(value: string, select: MatSelect) {
    const event = this.event();
    if (!event || value === event.id) return;
    if (value !== SHOW_MORE) {
      const url = this.issueService.eventUrlFor(value);
      if (url) this.router.navigateByUrl(url);
      return;
    }
    // Show more closed the panel: reopen it scrolled to the first new event.
    select.value = event.id;
    const known = new Set(this.switcherOptions().map((o) => o.id));
    await this.issueService.loadRecentEvents(true);
    const index = this.switcherOptions().findIndex((o) => !known.has(o.id));
    select.open();
    if (index >= 0) {
      afterNextRender(
        () => {
          const option = select.options.get(index);
          if (option) {
            document
              .getElementById(option.id)
              ?.scrollIntoView({ block: "nearest" });
          }
        },
        { injector: this.injector },
      );
    }
  }

  /** A short neutral tint that fades out, so the step reads as this event's. */
  private tintZone() {
    const el = this.zoneBody()?.nativeElement;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tint = getComputedStyle(el).getPropertyValue("--gt-step-tint");
    el.animate(
      [{ backgroundColor: tint }, { backgroundColor: "transparent" }],
      {
        duration: 300,
        easing: "ease-out",
      },
    );
  }

  scrollToRequest() {
    document
      .getElementById("request")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  copyForAI() {
    if (this.clipboard.copy(this.aiPayload())) {
      this.onCopiedForAI();
    } else {
      this.snackBar.open($localize`Could not copy to the clipboard`);
    }
  }

  onCopiedId() {
    this.snackBar.open($localize`Event ID copied`);
  }

  onCopiedTrace() {
    this.snackBar.open($localize`Trace copied`);
  }

  onCopiedLink() {
    this.snackBar.open($localize`Event link copied`);
  }

  /**
   * Fired after the "copy for AI" payload lands on the clipboard. Always
   * confirms the copy. When MCP is enabled on this instance and the one-time
   * tip hasn't been shown yet, the confirmation also nudges the user toward
   * connecting their agent live via MCP (instead of pasting), then marks the
   * tip as seen so it never nags again.
   */
  onCopiedForAI() {
    if (this.mcpEnabled() && !this.mcpHintSeen()) {
      this.mcpHintSeen.set(true);
      try {
        localStorage.setItem(MCP_COPY_HINT_SEEN_KEY, "true");
      } catch {
        // The hint may show again next visit.
      }
      const ref = this.snackBar.open(
        $localize`Copied. You can also connect your agent directly via MCP to pull this event, its related logs, and traces live instead of pasting.`,
        $localize`Set up MCP`,
        { duration: 12000 },
      );
      // Pass this instance's origin in the URL fragment (not a query param) so
      // the docs can pre-fill the setup examples. Fragments stay client-side
      // and aren't sent to glitchtip.com, so a self-hoster's domain isn't
      // logged there.
      const docsUrl =
        "https://glitchtip.com/documentation/mcp#instance=" +
        encodeURIComponent(window.location.origin);
      ref
        .onAction()
        .subscribe(() => window.open(docsUrl, "_blank", "noopener"));
    } else {
      this.snackBar.open($localize`Copied for AI`);
    }
  }
}
