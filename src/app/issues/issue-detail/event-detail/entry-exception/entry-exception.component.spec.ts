import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import type { Frame, Values } from "src/app/issues/interfaces";
import { IssueDetailService } from "../../issue-detail.service";
import { EntryExceptionComponent } from "./entry-exception.component";

const baseFrame: Frame = {
  absPath: null,
  filename: null,
  platform: null,
  module: null,
  function: null,
  package: null,
  instructionAddr: null,
  symbol: null,
  symbolAddr: null,
  trust: null,
  inApp: true,
  context: null,
  vars: null,
  lineNo: null,
  colNo: null,
};

function render(frame: Partial<Frame>, platform: string) {
  const chain = [
    {
      type: "Error",
      value: "boom",
      stacktrace: { frames: [{ ...baseFrame, ...frame }] },
    } as unknown as Values,
  ];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: IssueDetailService,
        useValue: {
          exceptionChain: signal(chain),
          exceptionTrace: signal(""),
          exceptionHasFrames: signal(true),
          isReversed: signal(true),
          event: signal({ platform }),
        },
      },
      { provide: MatSnackBar, useValue: { open: () => undefined } },
    ],
  });
  const fixture = TestBed.createComponent(EntryExceptionComponent);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent
    ?.replace(/\s+/g, " ")
    .trim();
}

// The open frame's meta line once lost the spaces around its words.
describe("EntryExceptionComponent frame meta", () => {
  it("keeps a space before the file and the package", () => {
    const text = render(
      {
        module: "com.shop.Pay",
        filename: "Pay.java",
        function: "run",
        lineNo: 10,
        package: "/usr/lib/libfoo.so",
      },
      "java",
    );
    expect(text).toContain("file Pay.java");
    expect(text).toMatch(/within \S*libfoo/);
  });
});
