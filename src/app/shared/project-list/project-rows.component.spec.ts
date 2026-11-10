// Type-only: declares the $localize global for the spec program. The runtime
// polyfill is already loaded by the test builder.
import type {} from "@angular/localize/init";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { client } from "src/app/shared/api/api";
import {
  DAYS,
  ProjectRowsComponent,
  statsHours,
  toDays,
  trendStart,
} from "./project-rows.component";

describe("statsHours", () => {
  it("turns stats_v2 into [seconds, count] hours, zero where empty", () => {
    const at = new Date(2026, 10, 9, 5);
    expect(
      statsHours({
        intervals: [at.toISOString(), at.toISOString()],
        groups: [{ series: { "sum(quantity)": [3, null] } }],
      }),
    ).toEqual([
      [at.getTime() / 1000, 3],
      [at.getTime() / 1000, 0],
    ]);
    expect(statsHours(undefined)).toEqual([]);
  });
});

/** Hours are summed per local day here, so the server never needs the zone. */
describe("toDays", () => {
  const start = new Date(2026, 9, 17);
  const hour = (day: number, h: number, count: number) => [
    new Date(2026, 9, 17 + day, h).getTime() / 1000,
    count,
  ];

  it("gives one bar per day, zero where no hour was returned", () => {
    const days = toDays([], start);
    expect(days.length).toBe(DAYS);
    expect(days.every((d) => d.value === 0)).toBe(true);
  });

  it("sums every hour of a day, not only the first", () => {
    const days = toDays(
      [hour(2, 0, 1), hour(2, 9, 5), hour(2, 23, 0), hour(3, 1, 2)],
      start,
    );
    expect(days[2].value).toBe(6);
    expect(days[3].value).toBe(2);
  });

  it("ignores hours outside the window", () => {
    const days = toDays([hour(-1, 12, 9), hour(DAYS, 12, 9)], start);
    expect(days.reduce((sum, d) => sum + d.value, 0)).toBe(0);
  });

  describe("across a daylight saving change", () => {
    const tz = process.env["TZ"];
    beforeAll(() => (process.env["TZ"] = "America/New_York"));
    afterAll(() => {
      if (tz === undefined) delete process.env["TZ"];
      else process.env["TZ"] = tz;
    });

    const dates = (days: { timestamp: number }[]) =>
      days.map((d) => new Date(d.timestamp).toDateString());
    const calendar = (y: number, m: number, from: number) =>
      Array.from({ length: DAYS }, (_, i) =>
        new Date(y, m, from + i).toDateString(),
      );

    it("runs in a zone with daylight saving", () => {
      expect(new Date(2027, 0, 1).getTimezoneOffset()).not.toBe(
        new Date(2027, 6, 1).getTimezoneOffset(),
      );
    });

    it("keeps every calendar day when the clocks go forward", () => {
      const start = trendStart(new Date(2027, 2, 20, 12));
      expect(start).toEqual(new Date(2027, 2, 7));
      const days = toDays(
        [[new Date(2027, 2, 14, 12).getTime() / 1000, 4]],
        start,
      );
      expect(dates(days)).toEqual(calendar(2027, 2, 7));
      expect(days[7].value).toBe(4);
    });

    it("keeps every calendar day when the clocks go back", () => {
      const start = trendStart(new Date(2026, 10, 3, 12));
      expect(start).toEqual(new Date(2026, 9, 21));
      expect(dates(toDays([], start))).toEqual(calendar(2026, 9, 21));
    });
  });
});

describe("ProjectRowsComponent", () => {
  function render(project: Partial<Record<string, unknown>>, settings = false) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProjectRowsComponent);
    fixture.componentRef.setInput("orgSlug", "acme");
    fixture.componentRef.setInput("opensSettings", settings);
    fixture.componentRef.setInput("projects", [
      {
        id: 7,
        name: "infra-cron",
        slug: "infra-cron",
        platform: "python-django",
        firstEvent: null,
        isMember: true,
        teams: [{ id: 1, slug: "platform" }],
        ...project,
      },
    ]);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("names the platform and teams, and marks a project with no events", () => {
    const el = render({});
    expect(el.textContent).toContain("Django");
    expect(el.textContent).toContain("#platform");
    expect(el.querySelector("gt-status-pill")?.textContent).toContain(
      "No events yet",
    );
  });

  it("opens a project's issues, or its settings in the settings list", () => {
    const link = (el: HTMLElement) =>
      el.querySelector("a[gtListRowLink]")!.getAttribute("href");
    expect(link(render({}))).toBe("/acme/issues?project=7");
    TestBed.resetTestingModule();
    expect(link(render({}, true))).toBe("/acme/settings/projects/infra-cron");
  });

  it("does not link a project the user is not a member of", () => {
    const el = render({ isMember: false });
    expect(el.querySelector("a[gtListRowLink]")).toBeNull();
    expect(el.textContent).toContain("Not a member");
  });

  describe("on the projects page", () => {
    afterEach(() => vi.restoreAllMocks());

    const projectsOf = (count: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `service-${i + 1}`,
        slug: `service-${i + 1}`,
        firstEvent: "2026-10-22",
        isMember: true,
      }));

    // A status for the summary response, or "offline" for a request that never gets one
    async function renderTrend(
      summary: number | "offline",
      count = 2,
      omit?: number,
    ) {
      const projects = projectsOf(count);
      const calls: { url: string; ids?: number[] }[] = [];
      vi.spyOn(client, "GET").mockImplementation((async (
        url: string,
        init: { params: { query?: { project?: number[] } } },
      ) => {
        const ids = init.params.query?.project;
        calls.push({ url, ids });
        if (url.endsWith("/projects/summary/")) {
          if (summary === "offline") throw new TypeError("Failed to fetch");
          return {
            data: ids!
              .filter((id) => id !== omit)
              .map((id) => ({
                id: String(id),
                unresolved: id * 100,
                lastSeen: null,
                hours: [[Date.now() / 1000, 3]],
              })),
            response: new Response(null, { status: summary }),
          };
        }
        const headers = { link: "", "x-hits": "5", "x-max-hits": "1000" };
        return {
          data: url.endsWith("/stats_v2/") ? { intervals: [], groups: [] } : [],
          response: new Response(null, { status: 200, headers }),
        };
      }) as never);
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const fixture = TestBed.createComponent(ProjectRowsComponent);
      fixture.componentRef.setInput("orgSlug", "acme");
      fixture.componentRef.setInput("projects", projects);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      // Every row has settled once no skeleton is still pulsing.
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(client.GET).toHaveBeenCalled();
        expect(el.querySelectorAll(".glance__skeleton--loading").length).toBe(
          0,
        );
      });
      return { el, calls };
    }

    const summaryCalls = (calls: { url: string; ids?: number[] }[]) =>
      calls.filter((call) => call.url.endsWith("/projects/summary/"));
    const failedRows = (el: HTMLElement) =>
      el.querySelectorAll(".glance__skeleton:not(.glance__skeleton--loading)")
        .length;

    it("loads every visible row from one summary request", async () => {
      const { el, calls } = await renderTrend(200);
      expect(calls.map((call) => call.ids)).toEqual([[1, 2]]);
      expect(el.textContent).toContain("100 unresolved");
      expect(el.textContent).toContain("200 unresolved");
    });

    it("marks a row the summary leaves out as failed", async () => {
      const { el } = await renderTrend(200, 2, 2);
      expect(el.textContent).toContain("100 unresolved");
      expect(el.textContent).not.toContain("200 unresolved");
      expect(failedRows(el)).toBe(1);
    });

    it("splits more than 100 rows across requests", async () => {
      const { calls } = await renderTrend(200, 101);
      expect(summaryCalls(calls).map((call) => call.ids!.length)).toEqual([
        100, 1,
      ]);
    });

    it("falls back to a request per fact when the backend has no summary", async () => {
      const { el, calls } = await renderTrend(404);
      expect(summaryCalls(calls).length).toBe(1);
      expect(calls.length).toBe(1 + 3 * 2);
      expect(el.textContent).toContain("5 unresolved");
    });

    it("loads a batch the summary rejects the old way", async () => {
      const { el, calls } = await renderTrend(422);
      expect(summaryCalls(calls).length).toBe(1);
      expect(calls.length).toBe(1 + 3 * 2);
      expect(el.textContent).toContain("5 unresolved");
    });

    for (const summary of [403, "offline"] as const) {
      it(`marks the batch failed without retrying when ${summary === 403 ? "forbidden" : "offline"}`, async () => {
        const { el, calls } = await renderTrend(summary);
        expect(calls.length).toBe(1);
        expect(failedRows(el)).toBe(2);
      });
    }
  });

  describe("in the settings list", () => {
    afterEach(() => vi.restoreAllMocks());

    async function renderSettings(alertCount: number) {
      vi.spyOn(client, "GET").mockResolvedValue({
        data: Array.from({ length: alertCount }, (_, id) => ({ id })),
        response: new Response(null, { status: 200 }),
      } as never);
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const fixture = TestBed.createComponent(ProjectRowsComponent);
      fixture.componentRef.setInput("orgSlug", "acme");
      fixture.componentRef.setInput("opensSettings", true);
      fixture.componentRef.setInput("showTrend", false);
      fixture.componentRef.setInput("projects", [
        {
          id: 7,
          name: "api",
          slug: "api",
          firstEvent: "2026-10-22",
          isMember: true,
        },
      ]);
      fixture.detectChanges();
      const text = () => {
        fixture.detectChanges();
        return (fixture.nativeElement as HTMLElement).textContent ?? "";
      };
      // The row loads after it is seen, so wait for the request to resolve.
      await vi.waitFor(() => expect(client.GET).toHaveBeenCalled());
      await new Promise((done) => setTimeout(done));
      return text();
    }

    it("shows the alert count once the row loads", async () => {
      expect(await renderSettings(3)).toContain("3 alerts");
    });

    it("says nothing about alerts when there are none", async () => {
      expect(await renderSettings(0)).not.toContain("alert");
    });
  });
});
