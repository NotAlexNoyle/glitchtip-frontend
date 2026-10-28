import { describe, expect, it } from "vitest";
import { Breadcrumb, Frame, Values } from "../../interfaces";
import {
  crumbSummary,
  formatValue,
  frameDisplay,
  frameLineCol,
  framePackage,
  hideFunctionName,
  packageOf,
  rawTrace,
  stackFrames,
  toRows,
  toggled,
} from "./event-format";

function frame(overrides: Partial<Frame>): Frame {
  return {
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
    ...overrides,
  };
}

function exception(
  type: string,
  value: string,
  frames: Frame[],
  extra: Partial<Values> = {},
): Values {
  return {
    type,
    value,
    stacktrace: {
      frames,
      framesOmitted: null,
      registers: null,
      hasSystemFrames: false,
    },
    ...extra,
  };
}

function crumb(overrides: Partial<Breadcrumb>): Breadcrumb {
  return {
    message: null,
    category: "",
    data: null,
    level: "info",
    type: "default",
    timestamp: "2026-10-01T10:00:00Z",
    ...overrides,
  } as Breadcrumb;
}

describe("formatValue", () => {
  it("writes null and booleans as words", () => {
    expect(formatValue(null)).toBe("null");
    expect(formatValue(undefined)).toBe("null");
    expect(formatValue(false)).toBe("false");
    expect(formatValue(42)).toBe("42");
    expect(formatValue("plain")).toBe("plain");
  });

  it("writes objects on one line, quoting keys only when needed", () => {
    expect(formatValue({ sku: "SKU-1", "x-y": null, n: [1, true] })).toBe(
      '{ sku: "SKU-1", "x-y": null, n: [1, true] }',
    );
    expect(formatValue({})).toBe("{}");
  });

  it("indents objects longer than 160 characters", () => {
    const long = { text: "a".repeat(170) };
    expect(formatValue(long)).toBe(JSON.stringify(long, null, 2));
    const many = Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [`k${i}`, i]),
    );
    expect(formatValue(many)).toBe(JSON.stringify(many, null, 2));
  });
});

describe("toRows", () => {
  it("keeps object order, skips keys and flags long values", () => {
    expect(toRows({ a: "x", type: "os", b: "y".repeat(30) }, ["type"])).toEqual(
      [
        { key: "a", value: "x", long: false },
        { key: "b", value: "y".repeat(30), long: true },
      ],
    );
    expect(toRows(null)).toEqual([]);
  });
});

describe("frame display", () => {
  it("names the module first for java and csharp, the file elsewhere", () => {
    const f = frame({ filename: "Cart.java", module: "shop.Cart" });
    expect(frameDisplay(f, "java")).toBe("shop.Cart");
    expect(frameDisplay(f, "csharp")).toBe("shop.Cart");
    expect(frameDisplay(f, "python")).toBe("Cart.java");
    expect(frameDisplay(frame({ absPath: "/srv/a.py" }), "python")).toBe(
      "/srv/a.py",
    );
  });

  it("trims iOS paths to the bundle", () => {
    const f = frame({
      filename: "/private/var/Shop.app/Frameworks/Kit.framework/Kit",
      package: "/var/containers/Shop.app/Shop",
    });
    expect(frameDisplay(f, "cocoa")).toBe(
      "Shop.app/Frameworks/Kit.framework/Kit",
    );
    expect(framePackage(f, "cocoa")).toBe("Shop.app/Shop");
    expect(framePackage(f, "python")).toBe("/var/containers/Shop.app/Shop");
  });

  it("hides a mangled Swift name when the file names the frame", () => {
    const f = frame({ function: "$s4Shop4CartC", filename: "Cart.swift" });
    expect(hideFunctionName(f, "cocoa")).toBe(true);
    expect(hideFunctionName({ ...f, filename: null }, "cocoa")).toBe(false);
    expect(hideFunctionName(f, "javascript")).toBe(false);
  });

  it("finds the package of library frames", () => {
    expect(
      packageOf(frame({ filename: "node_modules/@sentry/core/index.js" })),
    ).toBe("@sentry/core");
    expect(
      packageOf(frame({ absPath: "/usr/lib/site-packages/django/views.py" })),
    ).toBe("django");
    expect(packageOf(frame({ module: "rails.engine" }))).toBe("rails");
  });

  it("writes line and column", () => {
    expect(frameLineCol(frame({ lineNo: 12, colNo: 4 }))).toBe("12:4");
    expect(frameLineCol(frame({ lineNo: 12 }))).toBe("12");
    expect(frameLineCol(frame({}))).toBe("");
  });

  it("reads frames in API order and tolerates a missing stacktrace", () => {
    const value = exception("E", "", [
      frame({ function: "outer" }),
      frame({ function: "inner" }),
    ]);
    expect(stackFrames(value).map((f) => f.function)).toEqual([
      "outer",
      "inner",
    ]);
    expect(stackFrames({ type: "E", value: "", stacktrace: {} })).toEqual([]);
  });
});

describe("rawTrace", () => {
  const outer = frame({
    function: "submit",
    filename: "app/checkout.js",
    module: "app.checkout",
    lineNo: 10,
    colNo: 3,
    context: [[10, "  pay();"]],
  });
  const inner = frame({
    function: "pay",
    filename: "app/pay.js",
    module: "app.pay",
    lineNo: 20,
    colNo: 5,
    context: [[20, "  throw err;"]],
  });

  it("writes JavaScript frames newest first with Caused by links", () => {
    const thrown = exception("Error", "Checkout failed", [outer, inner]);
    const cause = exception("TypeError", "x is undefined", [inner]);
    expect(rawTrace([thrown, cause], "javascript")).toBe(
      [
        "Error: Checkout failed",
        "    at pay (app/pay.js:20:5)",
        "    at submit (app/checkout.js:10:3)",
        "",
        "Caused by: TypeError: x is undefined",
        "    at pay (app/pay.js:20:5)",
      ].join("\n"),
    );
  });

  it("writes Python as a traceback, root cause first", () => {
    const thrown = exception("ValueError", "bad cart", [outer]);
    const root = exception("ZeroDivisionError", "division by zero", [inner], {
      mechanism: { type: "chained", handled: true, source: "__context__" },
    });
    expect(rawTrace([thrown, root], "python")).toBe(
      [
        "Traceback (most recent call last):",
        '  File "app/pay.js", line 20, in pay',
        "    throw err;",
        "ZeroDivisionError: division by zero",
        "",
        "During handling of the above exception, another exception occurred:",
        "",
        "Traceback (most recent call last):",
        '  File "app/checkout.js", line 10, in submit',
        "    pay();",
        "ValueError: bad cart",
      ].join("\n"),
    );
  });

  it("follows the java, ruby, php and native formats", () => {
    const java = exception("NullPointerException", "cart", [outer], {
      module: "java.lang",
    });
    expect(rawTrace([java], "java")).toBe(
      [
        "java.lang.NullPointerException: cart",
        "    at app.checkout.submit(app/checkout.js:10)",
      ].join("\n"),
    );
    expect(rawTrace([exception("E", "", [outer])], "ruby")).toBe(
      "E\n  from app/checkout.js:10:3:in `submit'",
    );
    expect(rawTrace([exception("E", "", [outer, inner])], "php")).toBe(
      "E\n#0 app/pay.js(20): pay\n#1 app/checkout.js(10): submit",
    );
    const native = frame({
      package: "Shop",
      instructionAddr: "0x1",
      symbolAddr: "0x2",
    });
    expect(rawTrace([exception("E", "", [native])], "cocoa")).toBe(
      "E\n  Shop 0x1 0x2",
    );
  });

  it("leaves out a missing type or value", () => {
    expect(rawTrace([exception("", "only a message", [])], "node")).toBe(
      "only a message",
    );
    expect(rawTrace([exception("TypeError", "", [])], "node")).toBe(
      "TypeError",
    );
  });

  it("falls back to File and Module lines", () => {
    expect(rawTrace([exception("E", "", [inner])], "elixir")).toBe(
      'E\n  File "app/pay.js", line 20, col 5, in pay\n    throw err;',
    );
  });
});

describe("crumbSummary", () => {
  it("uses the message first", () => {
    expect(crumbSummary(crumb({ message: "Clicked pay" }))).toBe("Clicked pay");
  });

  it("summarises requests, navigations and other data", () => {
    expect(
      crumbSummary(
        crumb({ data: { method: "POST", url: "/api/pay", status_code: 500 } }),
      ),
    ).toBe("POST /api/pay · 500");
    expect(crumbSummary(crumb({ data: { from: "/cart", to: "/pay" } }))).toBe(
      "/cart → /pay",
    );
    expect(
      crumbSummary(crumb({ data: { url: { href: "/a" }, status_code: 0 } })),
    ).toBe('{ href: "/a" } · 0');
    expect(crumbSummary(crumb({ data: { a: 1, b: 2 } }))).toBe("a, b");
    expect(crumbSummary(crumb({}))).toBe("");
  });
});

describe("toggled", () => {
  it("adds a missing key and removes a present one, without mutating", () => {
    const set = new Set(["a"]);
    expect([...toggled(set, "b")]).toEqual(["a", "b"]);
    expect([...toggled(set, "a")]).toEqual([]);
    expect([...set]).toEqual(["a"]);
  });
});
