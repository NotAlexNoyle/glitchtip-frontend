import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { IssueDetailService } from "../../issue-detail.service";
import { EntryBreadcrumbsComponent } from "./entry-breadcrumbs.component";

function render(values: object[]) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: IssueDetailService,
        useValue: { breadcrumbs: signal({ values }), event: signal(null) },
      },
    ],
  });
  const fixture = TestBed.createComponent(EntryBreadcrumbsComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe("EntryBreadcrumbsComponent", () => {
  it("leaves the time blank for a breadcrumb without a timestamp", () => {
    const el = render([{ category: "nav", message: "no time" }]);
    expect(el.textContent).toContain("no time");
    expect(el.textContent).not.toMatch(/\d\d:\d\d:\d\d/);
  });

  // The API types these as a string and an object; payloads do not have to.
  it("renders a message or data of the wrong type", () => {
    const el = render([
      { timestamp: "2026-10-01T10:00:00Z", message: { text: "hi" } },
      { timestamp: "2026-10-01T10:00:01Z", data: "plain text" },
      { timestamp: "2026-10-01T10:00:02Z", level: "constructor", data: [] },
    ]);
    expect(el.textContent).toContain('{ text: "hi" }');
    expect(el.textContent).toContain("plain text");
    // Nothing inside to open, so no row is a toggle.
    expect(el.querySelector("button.crumbs__row")).toBeNull();
    expect(el.textContent).not.toContain("native code");
  });
});
