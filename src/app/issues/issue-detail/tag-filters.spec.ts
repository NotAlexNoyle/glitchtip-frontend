import { describe, expect, it } from "vitest";
import {
  byTagSignal,
  isSpreadTag,
  isUserTag,
  tagFilterParams,
} from "./tag-filters";

describe("tag filters", () => {
  it("treats only user and user.* as user tags", () => {
    expect(isUserTag("user")).toBe(true);
    expect(isUserTag("user.email")).toBe(true);
    expect(isUserTag("user_agent")).toBe(false);
    expect(isSpreadTag("user_agent", [])).toBe(true);
    expect(isSpreadTag("browser.name", ["browser"])).toBe(false);
  });

  it("ranks tags with a spread first, then single-value tags, ties by key", () => {
    const tag = (key: string, uniqueValues: number, percent: number) => ({
      key,
      uniqueValues,
      topValues: [{ percent }] as never,
    });
    const keys = [
      tag("server_name", 1, 100),
      tag("region", 3, 40),
      tag("environment", 1, 100),
      tag("feature_flag", 2, 93),
      tag("plan", 2, 40),
    ]
      .sort(byTagSignal)
      .map((t) => t.key);
    expect(keys).toEqual([
      "feature_flag",
      "plan",
      "region",
      "environment",
      "server_name",
    ]);
  });

  it("keeps the page's project and environment and adds the tag", () => {
    const current = { project: "4", environment: "prod", cursor: "x" };
    expect(tagFilterParams("browser", "Chrome", current)).toEqual({
      project: "4",
      environment: "prod",
      query: 'is:unresolved "browser":"Chrome"',
    });
    expect(tagFilterParams("environment", "staging", current)).toEqual({
      project: "4",
      environment: "staging",
    });
  });
});
