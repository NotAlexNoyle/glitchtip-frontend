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

function renderChain(chain: object[], newestFirst = true) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: IssueDetailService,
        useValue: {
          exceptionChain: signal(chain as Values[]),
          exceptionTrace: signal(""),
          exceptionHasFrames: signal(true),
          isReversed: signal(newestFirst),
          event: signal({ platform: "native" }),
        },
      },
      { provide: MatSnackBar, useValue: { open: () => undefined } },
    ],
  });
  const fixture = TestBed.createComponent(EntryExceptionComponent);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

const texts = (el: HTMLElement, selector: string) =>
  [...el.querySelectorAll(selector)].map((n) =>
    n.textContent!.replace(/\s+/g, " ").trim(),
  );

describe("EntryExceptionComponent frames", () => {
  const stack = (n: number) => ({
    frames: Array.from({ length: n }, (_, i) => ({
      ...baseFrame,
      function: `step${i}`,
      filename: "app.c",
    })),
  });

  it("keeps the crash end of a long stack in either order", () => {
    const chain = [{ type: "E", value: "boom", stacktrace: stack(40) }];
    const newest = texts(renderChain(chain, true), ".frame__fn");
    expect(newest.slice(0, 2)).toEqual(["step39", "step38"]);
    expect(newest).toHaveLength(10);

    const el = renderChain(chain, false);
    const oldest = texts(el, ".frame__fn");
    expect(oldest.slice(-2)).toEqual(["step38", "step39"]);
    expect(oldest).toHaveLength(10);
    // The hidden frames are older, so the way to them sits above.
    expect(el.querySelector(".frames")!.firstElementChild!.className).toBe(
      "frames__more",
    );
  });

  it("names a frame that has only an address and a package", () => {
    const el = renderChain([
      {
        type: "E",
        value: "boom",
        stacktrace: {
          frames: [
            {
              ...baseFrame,
              instructionAddr: "0x1000",
              package: "/usr/lib/libfoo.dylib",
            },
          ],
        },
      },
    ]);
    expect(texts(el, ".frame__fn")).toEqual(["0x1000"]);
    expect(texts(el, ".frame__file")).toEqual(["libfoo.dylib"]);
  });

  it("says nothing about handled or a type the SDK did not send", () => {
    const el = renderChain([
      { type: "Outer", value: "a", mechanism: { type: "generic" } },
      { type: "", value: "inner text", mechanism: { type: "chained" } },
    ]);
    expect(texts(el, ".mech-line")).toEqual(["mechanism generic"]);
    expect(texts(el, ".chain__type")).toEqual(["Outer:", ""]);
  });
});

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
