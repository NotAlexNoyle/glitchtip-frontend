import { describe, expect, it } from "vitest";
import { isSpreadTag, isUserTag, tagFilterParams } from "./tag-filters";

describe("tag filters", () => {
  it("treats only user and user.* as user tags", () => {
    expect(isUserTag("user")).toBe(true);
    expect(isUserTag("user.email")).toBe(true);
    expect(isUserTag("user_agent")).toBe(false);
    expect(isSpreadTag("user_agent", [])).toBe(true);
    expect(isSpreadTag("browser.name", ["browser"])).toBe(false);
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
