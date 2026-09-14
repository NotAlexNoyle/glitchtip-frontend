/**
 * Platform → logo mapping. A project's `platform` is an SDK slug like
 * "python-django", "javascript-react", "node-express". We map it to a bundled
 * Devicon (MIT) SVG — preferring the *framework* logo when the slug names one
 * (django, react, rails…), otherwise the base language (python, go…). Unknown
 * platforms return null (the card just shows no logo).
 *
 * Curated to the platforms GlitchTip actually supports (see the platform
 * picker), so the asset set stays small and self-contained (no CDN, no runtime
 * font) — the icons live in src/assets/platform-icons and lazy-load per <img>.
 */

// slug token → icon filename (in static/assets/platform-icons/)
const ICON_BY_TOKEN: Record<string, string> = {
  python: "python",
  django: "django",
  flask: "flask",
  javascript: "javascript",
  typescript: "typescript",
  react: "react",
  vue: "vue",
  angular: "angular",
  node: "nodejs",
  nodejs: "nodejs",
  express: "nodejs",
  go: "go",
  ruby: "ruby",
  rails: "rails",
  php: "php",
  laravel: "laravel",
  java: "java",
  spring: "java",
  kotlin: "kotlin",
  csharp: "csharp",
  dotnet: "dotnetcore",
  dotnetcore: "dotnetcore",
  net: "dotnetcore",
  rust: "rust",
  elixir: "elixir",
  swift: "swift",
  dart: "dart",
  flutter: "dart",
  cocoa: "apple",
  apple: "apple",
  ios: "apple",
  electron: "electron",
};

// Framework tokens take priority over the base language when both are present.
const FRAMEWORK_TOKENS = [
  "react",
  "vue",
  "angular",
  "rails",
  "laravel",
  "django",
  "flask",
  "flutter",
  "spring",
  "express",
  "electron",
];

/** The icon filename for a platform slug, or null if we don't have one. */
export function platformIconName(
  platform: string | null | undefined,
): string | null {
  if (!platform) return null;
  const tokens = platform.toLowerCase().split(/[-.]/);
  for (const fw of FRAMEWORK_TOKENS) {
    if (tokens.includes(fw)) return ICON_BY_TOKEN[fw];
  }
  return ICON_BY_TOKEN[tokens[0]] ?? null;
}

/** The asset URL for a platform's logo, or null. */
export function platformIconUrl(
  platform: string | null | undefined,
): string | null {
  const name = platformIconName(platform);
  return name ? `static/assets/platform-icons/${name}.svg` : null;
}
