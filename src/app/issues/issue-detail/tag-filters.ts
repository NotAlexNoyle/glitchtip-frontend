/** Tags worth comparing across events: no user ids, release or repeats. */
export function isSpreadTag(key: string, keys: string[]): boolean {
  if (key.startsWith("user")) return false;
  if (key === "release") return false;
  if (key === "browser.name" && keys.includes("browser")) return false;
  if (key === "os" && keys.includes("os.name")) return false;
  return true;
}

/** Issue list query params that filter by one tag value. */
export function tagQuery(
  key: string,
  value: string,
): { [param: string]: string } {
  if (key === "environment") {
    return { environment: value };
  }
  return { query: `is:unresolved "${key}":"${value}"` };
}
