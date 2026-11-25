import { describe, expect, it } from "vitest";
import { termValues } from "./search-terms";

describe("search terms", () => {
  it("reads every value of a repeated term", () => {
    expect(termValues("is:resolved is:ignored x", "is")).toEqual([
      "resolved",
      "ignored",
    ]);
  });

  it("skips empty values and keeps quoted parts whole", () => {
    expect(termValues("is: level:error", "is")).toEqual([]);
    expect(termValues('"title":"is:resolved here"', "is")).toEqual([]);
    expect(termValues(undefined, "is")).toEqual([]);
  });
});
