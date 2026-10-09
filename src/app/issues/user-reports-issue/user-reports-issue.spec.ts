// Type-only: declares the $localize global for the spec program. The runtime
// polyfill is already loaded by the test builder, and the app build picks the
// type up via main.ts, which the spec tsconfig does not include.
import type {} from "@angular/localize/init";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { UserReportsIssueComponent } from "./user-reports-issue";
import { client } from "src/app/shared/api/api";

describe("UserReportsIssueComponent", () => {
  let fixture: ComponentFixture<UserReportsIssueComponent>;
  let status: number;

  beforeEach(async () => {
    status = 200;
    // Stub at the openapi-fetch client, the seam the service actually calls;
    // a relative URL cannot be parsed by fetch under Node.
    vi.spyOn(client, "GET").mockImplementation((async () => {
      const ok = status < 400;
      return {
        data: ok ? [] : undefined,
        error: ok ? undefined : {},
        response: new Response(null, {
          status,
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
      imports: [UserReportsIssueComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  async function render() {
    fixture = TestBed.createComponent(UserReportsIssueComponent);
    fixture.componentRef.setInput("issue-id", "1");
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it("shows the error without the empty state when the request fails", async () => {
    status = 500;

    const el = await render();

    expect(el.textContent).toContain("500: Internal server error");
    expect(el.textContent).not.toContain("No user reports have been submitted");
  });

  it("shows the empty state when there are no reports", async () => {
    const el = await render();

    expect(el.textContent).toContain("No user reports have been submitted");
    expect(el.textContent).not.toContain("Internal server error");
  });
});
