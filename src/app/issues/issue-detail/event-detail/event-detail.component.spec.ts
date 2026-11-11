import type {} from "@angular/localize/init";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { Clipboard } from "@angular/cdk/clipboard";
import { OverlayContainer } from "@angular/cdk/overlay";
import { Router, provideRouter } from "@angular/router";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SettingsService } from "src/app/api/settings.service";
import { IssueDetailService, RecentEvents } from "../issue-detail.service";
import { EventDetailComponent } from "./event-detail.component";

interface TestEvent {
  id: string;
  eventID: string;
  groupID: string;
  dateCreated: string;
  tags: { key: string; value: string }[];
  user: null;
  previousEventID: string | null;
  nextEventID: string | null;
}

/** Events e1 (latest) to e5 (oldest), linked as the API links them. */
function eventAt(n: number, total = 5): TestEvent {
  return {
    id: `e${n}`,
    eventID: `e${n}`,
    groupID: "7",
    dateCreated: "2026-10-01T10:00:00Z",
    tags: [],
    user: null,
    previousEventID: n < total ? `e${n + 1}` : null,
    nextEventID: n > 1 ? `e${n - 1}` : null,
  };
}

const recentOf = (ids: number[], issueID = "7"): RecentEvents => ({
  issueID,
  events: ids.map((n) => eventAt(n)),
  cursor: null,
  loading: false,
  failed: false,
});

interface Options {
  features?: string[];
  /** False when the browser refuses the clipboard. */
  copies?: boolean;
}

/** Stands in for the overlay that open menus render into. */
const MENU = document.createElement("div");

function setup(
  first: TestEvent,
  recent: RecentEvents | null = null,
  { features = [], copies = true }: Options = {},
) {
  const event = signal<TestEvent | null>(first);
  const snackBar = {
    open: vi.fn((_message: string, _action?: string) => ({
      onAction: () => ({ subscribe: vi.fn() }),
    })),
  };
  const dialogs: object[] = [];
  const recentEvents = signal(recent);
  const url = (id?: string | null) =>
    id ? `/acme/issues/7/events/${id}` : null;
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: IssueDetailService,
        useValue: {
          event,
          recentEvents,
          issue: signal({ id: "7", count: "5" }),
          eventID: signal(null),
          hasNextEvent: computed(
            () => event() && event()!.nextEventID !== null,
          ),
          hasPreviousEvent: computed(
            () => event() && event()!.previousEventID !== null,
          ),
          nextEventUrl: computed(() => url(event()?.nextEventID)),
          previousEventUrl: computed(() => url(event()?.previousEventID)),
          eventUrlFor: url,
          exceptionTrace: signal(""),
          exceptionHasFrames: signal(false),
          eventInitialLoadComplete: signal(true),
          loadRecentEvents: vi.fn(),
          // Checks the names only, so a rename in the service fails here.
        } satisfies Partial<Record<keyof IssueDetailService, unknown>>,
      },
      {
        provide: SettingsService,
        useValue: {
          enabledFeatures: signal(features),
          instanceName: signal("GlitchTip"),
        },
      },
      { provide: MatSnackBar, useValue: snackBar },
      { provide: MatDialog, useValue: { openDialogs: dialogs } },
      { provide: Clipboard, useValue: { copy: () => copies } },
      // The real container loads styles jsdom cannot parse.
      {
        provide: OverlayContainer,
        useValue: { getContainerElement: () => MENU },
      },
    ],
  });
  // The bar's logic is under test, not the panels it hosts.
  TestBed.overrideComponent(EventDetailComponent, {
    set: { template: "", imports: [] },
  });
  const fixture = TestBed.createComponent(EventDetailComponent);
  fixture.componentRef.setInput("org-slug", "acme");
  fixture.componentRef.setInput("issue-id", "7");
  fixture.detectChanges();
  const show = (n: number) => {
    event.set(eventAt(n));
    fixture.detectChanges();
  };
  return {
    component: fixture.componentInstance,
    show,
    recentEvents,
    snackBar,
    dialogs,
  };
}

describe("EventDetailComponent position", () => {
  it("is 1 for the latest event", () => {
    expect(setup(eventAt(1)).component.position()).toBe(1);
  });

  it("is unknown for an older event opened directly", () => {
    expect(setup(eventAt(3)).component.position()).toBeNull();
  });

  it("comes from the switcher list once that has loaded", () => {
    const { component, recentEvents } = setup(eventAt(3));
    recentEvents.set(recentOf([1, 2, 3, 4]));
    expect(component.position()).toBe(3);
  });

  it("counts on by one for each step to an older or newer event", () => {
    const { component, show } = setup(eventAt(1));
    show(2);
    expect(component.position()).toBe(2);
    show(3);
    expect(component.position()).toBe(3);
    show(2);
    expect(component.position()).toBe(2);
  });

  it("counts on from the last event the switcher list holds", () => {
    const { component, show } = setup(eventAt(3), recentOf([1, 2, 3]));
    show(4);
    expect(component.position()).toBe(4);
  });

  it("does not guess after a jump that was not a single step", () => {
    const { component, show } = setup(eventAt(1));
    show(4);
    expect(component.position()).toBeNull();
  });
});

describe("EventDetailComponent switcher options", () => {
  it("marks the first as latest and the one on screen as current", () => {
    const { component } = setup(eventAt(2), recentOf([1, 2, 3]));
    const options = component.switcherOptions();
    expect(options.map((o) => o.id)).toEqual(["e1", "e2", "e3"]);
    expect(options.map((o) => o.latest)).toEqual([true, false, false]);
    expect(options.map((o) => o.current)).toEqual([false, true, false]);
    // The latest event lives at the issue URL.
    expect(options.map((o) => o.url)).toEqual([
      "/acme/issues/7",
      "/acme/issues/7/events/e2",
      "/acme/issues/7/events/e3",
    ]);
  });

  it("adds the event on screen last when the list does not reach it", () => {
    const { component } = setup(eventAt(5), recentOf([1, 2]));
    const options = component.switcherOptions();
    expect(options.map((o) => o.id)).toEqual(["e1", "e2", "e5"]);
    expect(options[2]).toMatchObject({ current: true, latest: false });
  });
});

describe("EventDetailComponent [ and ] keys", () => {
  function press(
    init: KeyboardEventInit,
    { from = document.body as Element, dialogOpen = false } = {},
  ) {
    const { dialogs } = setup(eventAt(2));
    if (dialogOpen) dialogs.push({});
    const navigate = vi
      .spyOn(TestBed.inject(Router), "navigateByUrl")
      .mockResolvedValue(true);
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    from.dispatchEvent(event);
    return { navigate, event };
  }

  it("steps to the older and the newer event", () => {
    const older = press({ key: "[" });
    expect(older.navigate).toHaveBeenCalledWith("/acme/issues/7/events/e3");
    // The key is handled here, so it must not reach the browser too.
    expect(older.event.defaultPrevented).toBe(true);

    const newer = press({ key: "]" });
    expect(newer.navigate).toHaveBeenCalledWith("/acme/issues/7/events/e1");
  });

  it("leaves browser shortcuts alone", () => {
    expect(press({ key: "[", metaKey: true }).navigate).not.toHaveBeenCalled();
    expect(press({ key: "[", ctrlKey: true }).navigate).not.toHaveBeenCalled();
  });

  it("works on layouts that type them with AltGr", () => {
    const init = { key: "[", ctrlKey: true, modifierAltGraph: true };
    expect(press(init).navigate).toHaveBeenCalled();
  });

  it("does nothing in a field, an open menu or under a dialog", () => {
    const field = document.body.appendChild(document.createElement("input"));
    expect(
      press({ key: "[" }, { from: field }).navigate,
    ).not.toHaveBeenCalled();
    field.remove();

    const item = MENU.appendChild(document.createElement("button"));
    document.body.append(MENU);
    expect(press({ key: "[" }, { from: item }).navigate).not.toHaveBeenCalled();
    MENU.remove();

    const under = press({ key: "[" }, { dialogOpen: true });
    expect(under.navigate).not.toHaveBeenCalled();
  });
});

describe("EventDetailComponent Copy for AI", () => {
  beforeEach(() => localStorage.clear());

  it("links to the event on screen, not the page URL", () => {
    const { component } = setup(eventAt(2));
    const link = `${window.location.origin}/acme/issues/7/events/e2`;
    expect(component.aiPayload()).toContain(`Event URL: ${link}`);
  });

  it("says so when the clipboard refuses", () => {
    const { component, snackBar } = setup(eventAt(1), null, { copies: false });
    component.copyForAI();
    expect(snackBar.open).toHaveBeenCalledWith(
      "Could not copy to the clipboard",
    );
  });

  it("points to MCP once, on instances that have it", () => {
    const { component, snackBar } = setup(eventAt(1), null, {
      features: ["mcp"],
    });
    component.copyForAI();
    component.copyForAI();
    const actions = snackBar.open.mock.calls.map((call) => call[1]);
    expect(actions).toEqual(["Set up MCP", undefined]);
  });
});
