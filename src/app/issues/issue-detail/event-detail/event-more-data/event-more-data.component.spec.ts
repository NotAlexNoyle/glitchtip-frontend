import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { IssueDetailService } from "../../issue-detail.service";
import { EventMoreDataComponent } from "./event-more-data.component";

function render(event: object) {
  TestBed.configureTestingModule({
    providers: [
      { provide: IssueDetailService, useValue: { event: signal(event) } },
    ],
  });
  const fixture = TestBed.createComponent(EventMoreDataComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const text = (node: Element) => node.textContent!.replace(/\s+/g, " ").trim();
  return {
    labels: () => [...el.querySelectorAll(".gt-kv__k")].map(text),
    open(label: string) {
      [...el.querySelectorAll<HTMLButtonElement>(".gt-kv__row")]
        .find((b) => text(b).startsWith(label))!
        .click();
      fixture.detectChanges();
      return [...el.querySelectorAll(".gt-property-list__row")].map((row) =>
        [...row.children].map(text).join(" "),
      );
    },
  };
}

// Payload fields are untrusted: none of these shapes may throw or print junk.
describe("EventMoreDataComponent", () => {
  it("lists a scalar or array context next to the object ones", () => {
    const view = render({
      contexts: {
        os: { type: "os", name: "macOS" },
        note: "abc",
        items: [1, 2],
        gone: null,
      },
    });
    expect(view.labels()).toEqual(["Contexts 3"]);
    expect(view.open("Contexts")).toEqual([
      "0 1",
      "1 2",
      "note abc",
      "name macOS",
    ]);
  });

  it("skips a user, extra or contexts value that is not an object", () => {
    const view = render({ user: "abc", context: "abc", contexts: "abc" });
    expect(view.labels()).toEqual([]);
  });

  it("reads SDK packages and integrations of any shape", () => {
    const view = render({
      sdk: {
        name: "sentry.javascript.browser",
        packages: [null, { name: "npm:react", version: "18.3.1" }, "x"],
        integrations: ["Dedupe", { odd: true }],
      },
    });
    expect(view.open("SDK")).toEqual([
      "name sentry.javascript.browser",
      "packages npm:react 18.3.1",
      "integrations Dedupe",
    ]);
  });
});
