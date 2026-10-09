// Type-only: declares the $localize global for the spec program. The runtime
// polyfill is already loaded by the test builder, and the app build picks the
// type up via main.ts, which the spec tsconfig does not include.
import type {} from "@angular/localize/init";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { ReleaseDetail } from "./release-detail";
import { client } from "src/app/shared/api/api";

type Reply = { status: number; statusText?: string; data?: unknown };

const RELEASE_URL =
  "/api/0/organizations/{organization_slug}/releases/{version}/";
const FILES_URL =
  "/api/0/organizations/{organization_slug}/releases/{version}/files/";

/**
 * A failed release request used to throw from release().value() during change
 * detection, which froze the page on its spinners with no error shown.
 */
describe("ReleaseDetail", () => {
  let fixture: ComponentFixture<ReleaseDetail>;
  let replies: Record<string, Reply>;

  beforeEach(async () => {
    replies = {
      [RELEASE_URL]: { status: 200, data: { version: "1.0.0" } },
      [FILES_URL]: { status: 200, data: [] },
    };
    // Stub at the openapi-fetch client, the seam the resource actually calls;
    // a relative URL cannot be parsed by fetch under Node.
    vi.spyOn(client, "GET").mockImplementation((async (url: string) => {
      const { status, statusText, data } = replies[url];
      const ok = status < 400;
      return {
        data: ok ? data : undefined,
        error: ok ? undefined : {},
        response: new Response(null, {
          status,
          statusText,
          headers: ok
            ? {
                link: '<http://localhost/>; rel="previous"; results="false"',
                "x-hits": "0",
                "x-max-hits": "0",
              }
            : {},
        }),
      };
    }) as unknown as typeof client.GET);

    await TestBed.configureTestingModule({
      imports: [ReleaseDetail],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  async function render() {
    fixture = TestBed.createComponent(ReleaseDetail);
    fixture.componentRef.setInput("org-slug", "org");
    fixture.componentRef.setInput("version", "1.0.0");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("shows the release error and settles when the release 404s", async () => {
    replies[RELEASE_URL] = { status: 404, statusText: "Not Found" };

    const el = await render();

    expect(el.querySelector(".table-empty-states li")?.textContent).toContain(
      "Not Found",
    );
    expect(el.textContent).not.toContain("There are no files");
    expect(el.querySelector("mat-progress-bar")).toBeNull();
    expect(el.querySelector("mat-progress-spinner")).toBeNull();
  });

  it("shows the release error once when both requests fail", async () => {
    replies[RELEASE_URL] = { status: 500 };
    replies[FILES_URL] = { status: 500 };

    const el = await render();

    expect(el.querySelectorAll(".table-empty-states li").length).toBe(1);
    expect(el.textContent).not.toContain("There are no files");
    expect(el.querySelector("mat-progress-spinner")).toBeNull();
  });

  it("renders the header and files empty state on success", async () => {
    const el = await render();

    expect(el.querySelector("gt-detail-header")?.textContent).toContain(
      "Release files for 1.0.0",
    );
    expect(el.textContent).toContain(
      "There are no files associated with this release.",
    );
    expect(el.querySelector(".table-empty-states li")).toBeNull();
  });
});
