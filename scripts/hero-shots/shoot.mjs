// Shoots the marketing hero stills from a running GlitchTip frontend: the
// issue list and a tall issue detail the hero pans down. Data is staged so nothing loads or looks stale on camera.
//
// env: BASE (frontend url), SID (session cookie), OUT (png dir), PWE (chrome)
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE ?? "http://127.0.0.1:4210";
const OUT = process.env.OUT;
const ORG = "acme-shop";
const HERO_ISSUE = "323";
// Just after the demo seed ran, so every "seen" reads minutes ago.
const NOW = new Date("2026-10-23T00:14:00Z");
const LIST = { width: 1180, height: 1000 };
const DETAIL = { width: 1180, height: 1240 }; // tall enough to pan into breadcrumbs

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PWE });
const ctx = await browser.newContext({
  viewport: LIST,
  deviceScaleFactor: 2,
  colorScheme: "light",
});
await ctx.addCookies([
  { name: "sessionid", value: process.env.SID, url: BASE },
]);
await ctx.addInitScript(() => {
  localStorage.setItem("glitchtip-sidenav-collapsed", "true");
  localStorage.setItem("theme", "light");
});
const page = await ctx.newPage();
await page.clock.install({ time: NOW });
await page.clock.resume();

// ── Staged data ─────────────────────────────────────────────────────────────
// Deterministic pseudo-random so every shoot gets the same trend shapes.
function rand(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function trend(id, total, n, stepSec, endSec) {
  const r = rand(Number(id) * 97 + n);
  const w = Array.from({ length: n }, (_, i) => {
    const ramp = 0.35 + (i / n) ** 1.6; // busier toward now
    return r() < 0.18 ? 0 : ramp * (0.4 + r());
  });
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  return w.map((x, i) => [
    endSec - (n - 1 - i) * stepSec,
    Math.round((x / sum) * total),
  ]);
}
const hourEnd = Math.floor(NOW.getTime() / 3600000) * 3600;
const dayEnd =
  Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()) / 1000;

await page.route(
  /\/api\/0\/organizations\/[^/]+\/issues\/\?/,
  async (route) => {
    const res = await route.fetch();
    const list = (await res.json()).filter((i) => new Date(i.lastSeen) <= NOW);
    await route.fulfill({ response: res, json: list });
  },
);
await page.route(/\/issues-stats\//, async (route) => {
  const res = await route.fetch();
  const list = await res.json();
  for (const i of list) {
    const c = Number(i.count);
    i.stats = {
      "24h": trend(i.id, Math.max(1, Math.round(c * 0.4)), 24, 3600, hourEnd),
      "14d": trend(i.id, c, 14, 86400, dayEnd),
    };
  }
  await route.fulfill({ response: res, json: list });
});

// No terms banner, scrollbars or blinking caret in a marketing still.
const CLEAN = `gt-terms-update-banner { display: none !important; }
  * { scrollbar-width: none !important; caret-color: transparent !important; }`;
async function settle() {
  await page.addStyleTag({ content: CLEAN });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800); // let enter animations finish
}
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

// 1. The issue list, loaded.
await page.goto(`${BASE}/${ORG}/issues?sort=-count`, {
  waitUntil: "networkidle",
});
await page.waitForSelector(`a[href*="/issues/${HERO_ISSUE}?"]`);
await settle();
await shot("list");

// 2. The issue detail, tall enough to pan from the header into the stack trace.
await page.setViewportSize(DETAIL);
await page.locator(`a[href*="/issues/${HERO_ISSUE}?"]`).first().click();
await page.waitForSelector("text=Cannot read properties of undefined", {
  timeout: 15000,
});
await settle();
await shot("detail");

await browser.close();
console.log("shots in", OUT);
