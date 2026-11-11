import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { OrganizationsService } from "src/app/api/organizations.service";
import { IssueDetailService } from "../../issue-detail.service";
import { EventFactsPanelComponent } from "./event-facts-panel.component";

const tag = (key: string, value: string) => ({ key, value });

function render(event: object, request?: object) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: IssueDetailService,
        useValue: {
          event: signal({ tags: [], contexts: {}, user: null, ...event }),
          eventEntryRequest: signal(request),
        },
      },
      {
        provide: OrganizationsService,
        useValue: { activeOrganizationSlug: signal("acme") },
      },
    ],
  });
  const fixture = TestBed.createComponent(EventFactsPanelComponent);
  fixture.detectChanges();
  return fixture;
}

const labels = (f: ReturnType<typeof render>) =>
  f.componentInstance.facts().map((p) => p.label);
const chipKeys = (f: ReturnType<typeof render>) =>
  f.componentInstance.chips().map((c) => c.key);

describe("EventFactsPanelComponent", () => {
  it("gives known tags their own row and makes the rest chips", () => {
    const f = render({
      tags: [
        tag("plan", "pro"),
        tag("browser", "Chrome 120"),
        tag("environment", "production"),
        tag("release", "1.4.0"),
        tag("server_name", "web-1"),
      ],
    });
    expect(labels(f)).toEqual(["Environment", "Release", "Browser"]);
    // Known keys first, then custom tags as sent.
    expect(chipKeys(f)).toEqual(["server_name", "plan"]);
  });

  it("sorts a chip that repeats a fact row last", () => {
    const f = render({
      tags: [
        tag("browser.name", "Chrome"),
        tag("browser", "Chrome 120"),
        tag("plan", "pro"),
      ],
    });
    expect(labels(f)).toEqual(["Browser"]);
    expect(chipKeys(f)).toEqual(["plan", "browser.name"]);
  });

  it("links the user from the User row, not from a chip as well", () => {
    const f = render({
      user: { email: "ada@example.com", id: "42" },
      tags: [tag("user.email", "ada@example.com"), tag("user.id", "42")],
    });
    const user = f.componentInstance.facts()[0];
    expect(user).toMatchObject({ label: "User", value: "ada@example.com" });
    expect(user.query).toBeTruthy();
    expect(chipKeys(f)).toEqual(["user.id"]);
  });

  it("leaves the url tag to the URL row when there is a request", () => {
    const f = render(
      { tags: [tag("url", "https://shop.test/cart")] },
      { url: "https://shop.test/cart", method: "GET", path: "/cart" },
    );
    expect(labels(f)).toEqual(["URL"]);
    expect(chipKeys(f)).toEqual([]);
  });

  it("shows Location only when it adds to the User row", () => {
    const ipOnly = render({ user: { ip_address: "203.0.113.9" } });
    expect(labels(ipOnly)).toEqual(["User"]);

    const withGeo = render({
      user: { ip_address: "203.0.113.9", geo: { city: "Lyon" } },
    });
    expect(withGeo.componentInstance.facts()).toMatchObject([
      { label: "User", value: "203.0.113.9" },
      { label: "Location", value: "Lyon · 203.0.113.9" },
    ]);
  });

  describe("cap", () => {
    const withFacts = (n: number) =>
      render({
        user: { email: "ada@example.com" },
        dateCreated: "2026-10-01T10:00:00Z",
        tags: [
          tag("environment", "production"),
          tag("release", "1.4.0"),
          tag("browser", "Chrome 120"),
          tag("os.name", "macOS"),
          tag("device", "Mac"),
          tag("runtime", "node"),
        ].slice(0, n - 2),
      });
    const toggle = (f: ReturnType<typeof render>) =>
      [...(f.nativeElement as HTMLElement).querySelectorAll("button")].find(
        (b) => b.textContent!.includes("Show"),
      );

    it("shows seven facts in full, as Show all would reveal just one", () => {
      const f = withFacts(7);
      expect(f.componentInstance.shown()).toHaveLength(7);
      expect(toggle(f)).toBeUndefined();
    });

    it("cuts eight facts to six until Show all is pressed", () => {
      const f = withFacts(8);
      expect(f.componentInstance.shown()).toHaveLength(6);
      expect(toggle(f)!.textContent).toContain("Show all 8");

      toggle(f)!.click();
      f.detectChanges();
      expect(f.componentInstance.shown()).toHaveLength(8);
      expect(toggle(f)!.textContent).toContain("Show fewer");
    });
  });
});
