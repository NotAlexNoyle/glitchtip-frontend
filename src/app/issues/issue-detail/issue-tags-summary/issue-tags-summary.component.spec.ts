import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { OrganizationsService } from "src/app/api/organizations.service";
import { IssueTagsAdjusted } from "../../interfaces";
import { IssueDetailService } from "../issue-detail.service";
import { IssueTagsSummaryComponent } from "./issue-tags-summary.component";

/** A tag of 100 events whose values hold the given shares, largest first. */
function tag(key: string, ...shares: number[]): IssueTagsAdjusted {
  const topValues = shares.map((percent, i) => ({
    key,
    name: `${key}-${i}`,
    value: `${key}-${i}`,
    count: percent,
    percent,
    percentRounded: percent,
    firstSeen: "",
    lastSeen: "",
  }));
  const other = 100 - shares.reduce((sum, s) => sum + s, 0);
  return {
    key,
    name: key,
    uniqueValues: shares.length + (other ? 1 : 0),
    totalValues: 100,
    topValues,
    ...(other ? { other } : {}),
  };
}

function render(tags: IssueTagsAdjusted[]) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: IssueDetailService, useValue: { tags: signal(tags) } },
      {
        provide: OrganizationsService,
        useValue: { activeOrganizationSlug: signal("acme") },
      },
    ],
  });
  const fixture = TestBed.createComponent(IssueTagsSummaryComponent);
  fixture.detectChanges();
  return fixture;
}

const topKeys = (f: ReturnType<typeof render>) =>
  f.componentInstance.top().map((t) => t.key);
const text = (f: ReturnType<typeof render>) =>
  (f.nativeElement as HTMLElement).textContent!.replace(/\s+/g, " ").trim();

describe("IssueTagsSummaryComponent", () => {
  it("puts the three most concentrated tags on the line", () => {
    const f = render([
      tag("plan", 40, 30),
      tag("region", 90, 10),
      tag("server_name", 100),
      tag("feature", 70, 30),
      tag("browser", 60, 40),
    ]);
    expect(topKeys(f)).toEqual(["region", "feature", "browser"]);
    // The full list keeps every tag, single-value ones last.
    expect(f.componentInstance.ranked().map((t) => t.key)).toEqual([
      "region",
      "feature",
      "browser",
      "plan",
      "server_name",
    ]);
  });

  it("keeps repeats of another tag off the line", () => {
    const f = render([
      tag("browser", 60, 40),
      tag("browser.name", 80, 20),
      tag("os", 70, 30),
      tag("os.name", 55, 45),
    ]);
    expect(topKeys(f)).toEqual(["browser", "os.name"]);
  });

  it("shows a user tag only when one user has half the events", () => {
    expect(topKeys(render([tag("user.email", 50, 20)]))).toEqual([
      "user.email",
    ]);
    expect(topKeys(render([tag("user.email", 49, 20)]))).toEqual([]);
    // One user tag at most, the most readable one.
    const both = render([tag("user.id", 80, 20), tag("user.email", 80, 20)]);
    expect(topKeys(both)).toEqual(["user.email"]);
  });

  it("offers All tags only when it would show more than the line", () => {
    const one = render([tag("environment", 100)]);
    expect(one.componentInstance.hasMore()).toBe(false);
    expect(text(one)).not.toContain("All 1 tag");

    const spread = render([tag("environment", 60, 40)]);
    expect(spread.componentInstance.hasMore()).toBe(true);
    expect(text(spread)).toContain("All 1 tag");

    const two = render([tag("environment", 100), tag("plan", 100)]);
    expect(text(two)).toContain("All 2 tags");
  });

  it("lists every value and the rest as Other when a tag is opened", () => {
    const f = render([tag("plan", 60, 30)]);
    const el = f.nativeElement as HTMLElement;
    const click = (selector: string) => {
      el.querySelector<HTMLButtonElement>(selector)!.click();
      f.detectChanges();
    };
    click("button[aria-controls]");
    click("button[aria-expanded]:not([aria-controls])");
    const values = [...el.querySelectorAll('ul[aria-label="plan"] li')].map(
      (li) => li.textContent!.replace(/\s+/g, "").trim(),
    );
    expect(values).toEqual(["plan-060%", "plan-130%", "Othervalues10%"]);
  });
});
