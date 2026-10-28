import { Json } from "src/app/interface-primitives";
import { Breadcrumb, Frame, Values } from "../../interfaces";
import { cleanIosPath, isIosPlatform, isSwiftNameMangled } from "../../utils";

/** Objects longer than this on one line are indented instead. */
const INLINE_MAX = 160;

/** A value as row text: null as a word, objects on one line until long. */
export function formatValue(value: Json | undefined): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const line = inline(value);
  return line !== null && line.length <= INLINE_MAX
    ? line
    : JSON.stringify(value, null, 2);
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** One-line form; null as soon as it passes the budget. */
function inline(
  value: Json | undefined,
  budget = { left: INLINE_MAX },
): string | null {
  if (value === null || value === undefined) return spend("null", budget);
  if (typeof value !== "object") {
    const text =
      typeof value === "string" ? JSON.stringify(value) : String(value);
    return spend(text, budget);
  }
  const isArray = Array.isArray(value);
  const parts: string[] = [];
  for (const [k, v] of Object.entries(value)) {
    const key = isArray ? "" : `${IDENT.test(k) ? k : JSON.stringify(k)}: `;
    const text = inline(v, budget);
    if (text === null || spend(key, budget) === null) return null;
    parts.push(key + text);
  }
  if (isArray) return `[${parts.join(", ")}]`;
  return parts.length ? `{ ${parts.join(", ")} }` : "{}";
}

function spend(text: string, budget: { left: number }): string | null {
  budget.left -= text.length;
  return budget.left < 0 ? null : text;
}

/** A long or multi-line value goes under its label on narrow panels. */
export function isLongValue(text: string): boolean {
  return text.length > 24 || text.includes("\n");
}

export interface PropertyRow {
  key: string;
  value: string;
  long: boolean;
}

/** Object entries as property rows, in their own order. */
export function toRows(
  obj: { [key: string]: Json } | null | undefined,
  skip: string[] = [],
): PropertyRow[] {
  if (!obj) return [];
  return Object.entries(obj)
    .filter(([key]) => !skip.includes(key))
    .map(([key, v]) => {
      const value = formatValue(v);
      return { key, value, long: isLongValue(value) };
    });
}

/** "react-dom" from node_modules paths, "django" from site-packages paths. */
export function packageOf(frame: Frame): string {
  const path = frame.filename || frame.absPath || "";
  const node = path.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (node) return node[1];
  const py = path.match(/(?:site|dist)-packages\/([^/]+)/);
  if (py) return py[1];
  if (frame.package) {
    return frame.package.split(/[\\/]/).pop() || frame.package;
  }
  if (frame.module) return frame.module.split(".")[0];
  return "";
}

/** Module first for java and csharp, else the filename; iOS paths trimmed. */
export function frameDisplay(
  frame: Frame,
  eventPlatform: string | null | undefined,
): string {
  const platform = eventPlatform || frame.platform;
  const value =
    platform === "java" || platform === "csharp"
      ? frame.module || frame.filename
      : frame.filename || frame.module;
  const display = value || frame.absPath || "";
  return display && isIosPlatform(platform) ? cleanIosPath(display) : display;
}

/** The package a frame runs in, with iOS paths trimmed to the bundle. */
export function framePackage(
  frame: Frame,
  eventPlatform: string | null | undefined,
): string {
  if (!frame.package) return "";
  return isIosPlatform(eventPlatform || frame.platform)
    ? cleanIosPath(frame.package)
    : frame.package;
}

/** A mangled Swift symbol says nothing when the file already names it. */
export function hideFunctionName(
  frame: Frame,
  eventPlatform: string | null | undefined,
): boolean {
  return (
    isSwiftNameMangled(frame.function, eventPlatform || frame.platform) &&
    !!(frame.filename || frame.module)
  );
}

export function isHttpUrl(value: string | null | undefined): boolean {
  return !!value && /^https?:\/\//.test(value);
}

export function frameLineCol(frame: Frame): string {
  if (!frame.lineNo) return "";
  return frame.colNo ? `${frame.lineNo}:${frame.colNo}` : `${frame.lineNo}`;
}

/** Frames as the API sends them: oldest first, the crash point last. */
export function stackFrames(value: Values): Frame[] {
  const st = value.stacktrace;
  if (st && "frames" in st && Array.isArray(st.frames)) return st.frames;
  return [];
}

/**
 * Raw view and Copy trace in each platform's own format. Python reads as a
 * traceback (root cause first); others start at the thrown exception.
 */
export function rawTrace(
  chainThrownFirst: Values[],
  platform: string | null | undefined,
): string {
  if (platform === "python") {
    return pythonTrace([...chainThrownFirst].reverse());
  }
  return chainThrownFirst
    .map((value, i) => {
      const head = `${i ? "Caused by: " : ""}${exceptionLine(value, platform)}`;
      const frames = [...stackFrames(value)]
        .reverse()
        .map((f, fi) => rawFrame(f, f.platform || platform, fi));
      return [head, ...frames].join("\n");
    })
    .join("\n\n");
}

function exceptionLine(
  value: Values,
  platform: string | null | undefined,
): string {
  const mod = platform === "java" && value.module ? value.module + "." : "";
  const type = value.type ? mod + value.type : "";
  return [type, value.value].filter(Boolean).join(": ");
}

function pythonTrace(rootFirst: Values[]): string {
  return rootFirst
    .map((value, i) => {
      const lines: string[] = [];
      if (i) {
        lines.push(
          rootFirst[i - 1].mechanism?.source === "__context__"
            ? "During handling of the above exception, another exception occurred:"
            : "The above exception was the direct cause of the following exception:",
          "",
        );
      }
      const frames = stackFrames(value);
      if (frames.length) {
        lines.push("Traceback (most recent call last):");
        frames.forEach((f, fi) => lines.push(rawFrame(f, "python", fi)));
      }
      lines.push(exceptionLine(value, "python"));
      return lines.join("\n");
    })
    .join("\n\n");
}

function contextLine(frame: Frame): string {
  const line = frame.context?.find((c) => c[0] === frame.lineNo)?.[1];
  return line ? String(line).trim() : "";
}

/** One frame line, following each platform's own trace format. */
function rawFrame(
  frame: Frame,
  platform: string | null | undefined,
  index: number,
): string {
  const fn = frame.function || "";
  const line = frame.lineNo && frame.lineNo > 0 ? frame.lineNo : null;
  const col = frame.colNo && frame.colNo > 0 ? frame.colNo : null;
  const lc = (line ? `:${line}` : "") + (col ? `:${col}` : "");
  switch (platform) {
    case "javascript":
    case "node": {
      const file = frame.filename || frame.module || "";
      return `    at ${fn || "?"} (${file}${lc})`;
    }
    case "ruby": {
      const file = frame.filename || (frame.module ? `(${frame.module})` : "?");
      return `  from ${file}${lc}${fn ? `:in \`${fn}'` : ""}`;
    }
    case "php":
      return `#${index} ${frame.filename || frame.module || "?"}(${
        frame.lineNo ?? ""
      }): ${fn || "{main}"}`;
    case "java": {
      const mod = frame.module ? frame.module + "." : "";
      const where = frame.filename
        ? `(${frame.filename}${line ? ":" + line : ""})`
        : "";
      return `    at ${mod}${fn}${where}`;
    }
    case "objc":
    case "cocoa":
    case "native": {
      const parts = [
        frame.package,
        frame.instructionAddr,
        fn || frame.symbolAddr,
      ].filter(Boolean);
      const where = frame.filename
        ? ` (${frame.filename}${line ? ":" + line : ""})`
        : "";
      return `  ${parts.join(" ")}${where}`;
    }
    case "python": {
      const ctx = contextLine(frame);
      return `  File "${frame.filename || frame.module || "?"}"${
        line ? `, line ${line}` : ""
      }, in ${fn || "?"}${ctx ? "\n    " + ctx : ""}`;
    }
    default: {
      const where = frame.filename
        ? `File "${frame.filename}"`
        : frame.module
          ? `Module "${frame.module}"`
          : "?";
      const ctx = contextLine(frame);
      return `  ${where}${line ? `, line ${line}` : ""}${
        col ? `, col ${col}` : ""
      }${fn ? `, in ${fn}` : ""}${ctx ? "\n    " + ctx : ""}`;
    }
  }
}

/** One-line summary of a breadcrumb: its message, or what its data says. */
export function crumbSummary(crumb: Breadcrumb): string {
  if (crumb.message) return crumb.message;
  const d = (crumb.data ?? {}) as { [key: string]: Json };
  if (d["url"] || d["method"]) {
    const parts = [d["method"], d["url"]]
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v) => formatValue(v))
      .join(" ");
    const status = d["status_code"];
    return status !== null && status !== undefined && status !== ""
      ? `${parts} · ${formatValue(status)}`
      : parts;
  }
  if (d["from"] !== undefined || d["to"] !== undefined) {
    return `${formatValue(d["from"] ?? "")} → ${formatValue(d["to"] ?? "")}`;
  }
  const keys = Object.keys(d);
  return keys.length ? keys.join(", ") : "";
}

/** A copy of the set with the key added or removed, for expandable rows. */
export function toggled<T>(set: ReadonlySet<T>, key: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}

export type EventContext = { [key: string]: unknown } | null | undefined;
export type EventContexts = { [key: string]: EventContext };

/** Context kinds that describe a tag, for its logo and the details tags lack. */
export const CONTEXT_OF: { [tag: string]: string } = {
  browser: "browser",
  "browser.name": "browser",
  "os.name": "os",
  os: "os",
  device: "device",
  runtime: "runtime",
  gpu: "gpu",
};

function str(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

/** A context by kind; older SDKs send the OS as client_os. */
export function contextFor(
  contexts: EventContexts,
  kind: string,
): EventContext {
  return contexts[kind] ?? (kind === "os" ? contexts["client_os"] : undefined);
}

/** The name a context is known (and its logo looked up) by; device: its model. */
export function contextName(kind: string, ctx: EventContext): string {
  if (!ctx) return "";
  return kind === "device" ? str(ctx["model"]) : str(ctx["name"]);
}

/** What a context adds to a fact: OS version or kernel, device arch, GPU vendor. */
export function contextDetail(
  kind: string,
  ctx: EventContext,
  value: string,
): string {
  if (!ctx) return "";
  const first = (...keys: string[]) =>
    keys.map((k) => str(ctx[k])).find(Boolean) ?? "";
  let detail = "";
  if (kind === "os") detail = first("version", "kernel_version");
  if (kind === "device") detail = first("arch", "model_id");
  if (kind === "gpu") detail = first("vendor_name");
  return detail && !value.includes(detail) ? detail : "";
}

/**
 * A fact from a context alone: its name and version. Null for "Other", a
 * nameless context, or a browser's runtime (that is the browser).
 */
export function contextFact(
  kind: string,
  ctx: EventContext,
): { name: string; value: string; detail: string } | null {
  const name = contextName(kind, ctx);
  if (!ctx || !name || name === "Other") return null;
  if (kind === "runtime" && name.toLowerCase() === "browser") return null;
  const version = kind === "device" || kind === "os" ? "" : str(ctx["version"]);
  const value = [name, version].filter(Boolean).join(" ");
  return { name, value, detail: contextDetail(kind, ctx, value) };
}

/** The user as one value (email first), its tag key and the other ids. */
export function eventUser(
  user: { [key: string]: unknown } | null | undefined,
): { value: string; key: string; others: string[] } | null {
  if (!user) return null;
  const keys: [string, string][] = [
    ["email", "user.email"],
    ["username", "user.username"],
    ["id", "user.id"],
    ["ip_address", "user.ip"],
  ];
  const hit = keys.find(([field]) => str(user[field]));
  if (!hit) return null;
  const value = str(user[hit[0]]);
  const others = [str(user["id"]), str(user["username"])].filter(
    (v) => v && v !== value,
  );
  return { value, key: hit[1], others: [...new Set(others)] };
}

/** "City, Region, CC · ip" from the user's geo and IP. */
export function userLocation(
  user: { [key: string]: unknown } | null | undefined,
): string {
  if (!user) return "";
  const geo = (user["geo"] ?? {}) as { [key: string]: unknown };
  const place = [geo["city"], geo["region"], geo["country_code"]]
    .map(str)
    .filter(Boolean)
    .join(", ");
  return [place, str(user["ip_address"])].filter(Boolean).join(" · ");
}

/** The trace id shortened to 8, with id, op and status for the tooltip. */
export function traceSummary(
  trace: EventContext,
): { short: string; full: string } | null {
  const id = trace ? str(trace["trace_id"]) : "";
  if (!trace || !id) return null;
  const full = [id, str(trace["op"]), str(trace["status"])]
    .filter(Boolean)
    .join(" · ");
  return { short: id.slice(0, 8), full };
}

/** The server got the event more than a minute after the client sent it. */
export function arrivedLate(
  sent: string,
  received: string | null | undefined,
): boolean {
  if (!received) return false;
  return Math.abs(Date.parse(received) - Date.parse(sent)) > 60_000;
}
