import { describe, expect, it } from "vitest";
import { termValue, termValues, withTerm } from "./search-terms";

describe("search terms", () => {
  it("reads a term's value, or null when the term is missing or empty", () => {
    expect(termValue("is:resolved level:error", "is")).toBe("resolved");
    expect(termValue("level:error", "is")).toBeNull();
    expect(termValue("is:", "is")).toBeNull();
    expect(termValue(undefined, "is")).toBeNull();
  });

  it("replaces a term and keeps the rest of the search", () => {
    expect(withTerm("is:unresolved level:error", "is", "resolved")).toBe(
      "level:error is:resolved",
    );
  });

  it("puts a new term before bare words, which end the backend's term parsing", () => {
    expect(withTerm("level:error timeout", "is", "ignored")).toBe(
      "level:error is:ignored timeout",
    );
  });

  it("removes the term when the value is null", () => {
    expect(withTerm("is:resolved timeout", "is", null)).toBe("timeout");
  });

  it("keeps quoted values with spaces in one piece", () => {
    const query = 'is:unresolved "browser":"Mobile Safari" timeout';
    expect(withTerm(query, "is", "resolved")).toBe(
      '"browser":"Mobile Safari" is:resolved timeout',
    );
    expect(termValue('"title":"is:resolved here"', "is")).toBeNull();
  });

  it("reads every value of a repeated term", () => {
    expect(termValues("is:resolved is:ignored x", "is")).toEqual([
      "resolved",
      "ignored",
    ]);
  });
});
