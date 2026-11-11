export const IOS_PLATFORMS = ["cocoa", "objc"] as const;

export const GRAMMAR_MAPPINGS: { [key: string]: string } = {
  node: "javascript",
  cocoa: "swift",
  objc: "objectivec",
};

// File extensions highlightLines knows; the platform is the fallback.
export const EXTENSION_GRAMMARS: Record<string, string> = {
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  java: "java",
  rb: "ruby",
  php: "php",
  go: "go",
  rs: "rust",
  swift: "swift",
  c: "c",
  h: "c",
  m: "objectivec",
  cs: "csharp",
  json: "json",
};
