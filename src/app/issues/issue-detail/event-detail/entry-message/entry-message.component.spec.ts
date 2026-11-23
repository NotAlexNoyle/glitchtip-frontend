import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { IssueDetailService } from "../../issue-detail.service";
import { EntryMessageComponent } from "./entry-message.component";

function render(message: object) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: IssueDetailService,
        useValue: {
          eventEntryMessage: signal(message),
          exceptionChain: signal([]),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(EntryMessageComponent);
  fixture.detectChanges();
  return [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll(".gt-kv__k"),
  ].map((k) =>
    [...k.childNodes]
      .filter((n) => n.nodeType !== Node.COMMENT_NODE)
      .map((n) => n.textContent!.trim())
      .filter(Boolean)
      .join(" "),
  );
}

describe("EntryMessageComponent", () => {
  it("shows the template only when a formatted text differs from it", () => {
    expect(
      render({ formatted: "5 items stale", message: "%s items stale" }),
    ).toEqual(["Message", "Template"]);
    // Older events have the text in message alone: not a template.
    expect(render({ message: "5 items stale" })).toEqual(["Message"]);
  });

  it("ignores params that are not a list or an object", () => {
    expect(render({ formatted: "hi", params: "ab" })).toEqual(["Message"]);
    expect(render({ formatted: "hi", params: { a: 1 } })).toEqual([
      "Message",
      "Params 1",
    ]);
  });
});
