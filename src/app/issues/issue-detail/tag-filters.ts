import { inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params } from "@angular/router";

/** Page filters a tag link keeps when it opens the issue list. */
const KEPT_FILTERS = ["project", "environment"];

export function isUserTag(key: string): boolean {
  return key === "user" || key.startsWith("user.");
}

/** Tags worth comparing across events: no user ids, release or repeats. */
export function isSpreadTag(key: string, keys: string[]): boolean {
  if (isUserTag(key)) return false;
  if (key === "release") return false;
  if (key === "browser.name" && keys.includes("browser")) return false;
  if (key === "os" && keys.includes("os.name")) return false;
  return true;
}

/** Issue list params for one tag value, keeping the page's project and environment. */
export function tagFilterParams(
  key: string,
  value: string,
  current: Params = {},
): Params {
  const params: Params = {};
  for (const k of KEPT_FILTERS) {
    if (current[k] !== undefined) params[k] = current[k];
  }
  if (key === "environment") {
    params["environment"] = value;
  } else {
    params["query"] = `is:unresolved "${key}":"${value}"`;
  }
  return params;
}

/** tagFilterParams bound to the current route; call in an injection context. */
export function injectTagFilter() {
  const current = toSignal(inject(ActivatedRoute).queryParams, {
    initialValue: {} as Params,
  });
  return (key: string, value: string) => tagFilterParams(key, value, current());
}
