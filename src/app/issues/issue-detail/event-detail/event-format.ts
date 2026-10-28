import { Json } from "src/app/interface-primitives";
import { Breadcrumb, Frame, Values } from "../../interfaces";
import { cleanIosPath, isIosPlatform, isSwiftNameMangled } from "../../utils";

/** A value as row text: null as a word, objects on one line until long. */
export function formatValue(value: Json | undefined): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const line = inline(value);
  return line.length > 160 ? JSON.stringify(value, null, 2) : line;
}

const IDENT = /^[A-Za-z_$][\w$]*$/;

function inline(value: Json | undefined): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(inline).join(", ")}]`;
  const entries = Object.entries(value);
  if (!entries.length) return "{}";
  const body = entries
    .map(([k, v]) => `${IDENT.test(k) ? k : JSON.stringify(k)}: ${inline(v)}`)
    .join(", ");
  return `{ ${body} }`;
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

function frameFrames(value: Values): Frame[] {
  const st = value.stacktrace;
  if (st && "frames" in st && Array.isArray(st.frames)) return st.frames;
  return [];
}

/** Frames most recent first (the API sends the crash point last). */
function framesNewestFirst(value: Values): Frame[] {
  return [...frameFrames(value)].reverse();
}

/** Frames in the order the reader picked. */
export function framesInOrder(value: Values, newestFirst: boolean): Frame[] {
  return newestFirst ? framesNewestFirst(value) : [...frameFrames(value)];
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
      const frames = framesNewestFirst(value).map((f, fi) =>
        rawFrame(f, f.platform || platform, fi),
      );
      return [head, ...frames].join("\n");
    })
    .join("\n\n");
}

function exceptionLine(
  value: Values,
  platform: string | null | undefined,
): string {
  const mod = platform === "java" && value.module ? value.module + "." : "";
  return `${mod}${value.type}${value.value ? ": " + value.value : ""}`;
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
      const frames = frameFrames(value);
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
    const parts = [d["method"], d["url"]].filter(Boolean).join(" ");
    return d["status_code"] ? `${parts} · ${d["status_code"]}` : parts;
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
