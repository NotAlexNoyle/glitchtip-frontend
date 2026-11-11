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
  instruction_addr: null,
  symbol: null,
  symbol_addr: null,
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

/** A frameless link has nothing to fold, so it has no aria-expanded. */
const expanded = (el: HTMLElement) =>
  [...el.querySelectorAll(".chain__head")].map((b) =>
    b.getAttribute("aria-expanded"),
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

  it("counts the frames inside the folded library runs it hides", () => {
    // Seven app frames, each followed by a run of three library frames.
    const frames = Array.from({ length: 28 }, (_, i) => ({
      ...baseFrame,
      function: `f${i}`,
      filename: "app.c",
      inApp: i % 4 === 0,
    }));
    const el = renderChain([
      { type: "E", value: "boom", stacktrace: { frames } },
    ]);
    // Ten rows show; two app frames and two runs of three do not.
    expect(texts(el, ".frames__more")).toEqual(["Show 8 more frames"]);
  });

  it("shows a link with no frames in full, as it cannot be opened", () => {
    const el = renderChain([
      { type: "Outer", value: "a long message" },
      { type: "Middle", value: "b", stacktrace: stack(1) },
      { type: "Inner", value: "c", stacktrace: stack(1) },
    ]);
    const open = [...el.querySelectorAll(".chain")].map((c) =>
      c.classList.contains("chain--open"),
    );
    // The middle link has frames and starts closed, so it stays clamped.
    expect(open).toEqual([true, false, true]);
  });

  it("opens the deepest link with frames when the root cause has none", () => {
    const el = renderChain([
      { type: "RuntimeError", value: "outer", stacktrace: stack(2) },
      { type: "ValueError", value: "quota 0" },
    ]);
    const open = [...el.querySelectorAll(".chain")].map((c) =>
      c.classList.contains("chain--open"),
    );
    expect(open).toEqual([true, true]);
    expect(el.querySelector(".frame__fn")).not.toBeNull();
  });

  it("calls a group's members In group, and none of them the root cause", () => {
    // As sentry-python sends a thrown ExceptionGroup, thrown first.
    const member = (type: string, i: number) => ({
      type,
      value: "x",
      stacktrace: stack(1),
      mechanism: { type: "chained", handled: true, source: `exceptions[${i}]` },
    });
    const el = renderChain([
      {
        type: "ExceptionGroup",
        value: "2 checks failed",
        stacktrace: stack(1),
      },
      member("ValueError", 0),
      member("TimeoutError", 1),
    ]);
    expect(texts(el, ".chain__role")).toEqual([
      "Thrown",
      "In group",
      "In group",
    ]);
    expect(el.querySelector(".chain--root")).toBeNull();
  });

  it("opens a group's first member with frames, not its last", () => {
    // As the MIT sentry JavaScript SDK sends an AggregateError, thrown first.
    const member = (type: string, i: number, frames: number) => ({
      type,
      value: "x",
      ...(frames ? { stacktrace: stack(frames) } : {}),
      mechanism: { type: "chained", handled: true, source: `errors[${i}]` },
    });
    const el = renderChain([
      { type: "AggregateError", value: "3 failed", stacktrace: stack(1) },
      member("SyntaxError", 0, 0),
      member("RangeError", 1, 1),
      member("TypeError", 2, 1),
    ]);
    expect(expanded(el)).toEqual(["false", null, "true", "false"]);
  });

  it("opens the group itself when no member has frames", () => {
    // As sentry-go sends errors.Join: members carry no frames.
    const member = (i: number) => ({
      type: "*errors.errorString",
      value: "x",
      mechanism: { type: "chained", source: `errors[${i}]` },
    });
    const el = renderChain([
      { type: "*errors.joinError", value: "a\nb", stacktrace: stack(1) },
      member(0),
      member(1),
    ]);
    expect(expanded(el)).toEqual(["true", null, null]);
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
              instruction_addr: "0x1000",
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

// Angular drops whitespace between elements, so the words need their own.
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
