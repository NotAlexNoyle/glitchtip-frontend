import { inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Params } from "@angular/router";
import { IssueTagsAdjusted } from "../interfaces";

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

type RankableTag = Pick<
  IssueTagsAdjusted,
  "key" | "uniqueValues" | "topValues"
>;

/** A tag's top share; a tag with one value says nothing about spread and sinks. */
const tagSignal = (tag: RankableTag) =>
  tag.uniqueValues > 1 ? (tag.topValues[0]?.percent ?? 0) : -1;

/** Most concentrated tags first; ties by key, so the order holds between loads. */
export function byTagSignal(a: RankableTag, b: RankableTag): number {
  return tagSignal(b) - tagSignal(a) || a.key.localeCompare(b.key);
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
