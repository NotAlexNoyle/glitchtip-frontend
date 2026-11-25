import { describe, expect, it } from "vitest";
import {
  assignedFilter,
  assignedValueFor,
  withAssignedFilter,
} from "./assignee-query";

describe("assignedFilter", () => {
  it("reads the assigned: value", () => {
    expect(assignedFilter("is:unresolved assigned:me timeout")).toBe("me");
    expect(assignedFilter("assigned:#platform")).toBe("#platform");
  });

  it("is null without one", () => {
    expect(assignedFilter("is:unresolved")).toBeNull();
    expect(assignedFilter(undefined)).toBeNull();
    expect(assignedFilter("assigned:")).toBeNull();
  });
});

describe("withAssignedFilter", () => {
  it("adds the term before free text, which the backend reads last", () => {
    expect(withAssignedFilter("is:unresolved timeout", "me")).toBe(
      "is:unresolved assigned:me timeout",
    );
  });

  it("replaces an existing term instead of adding a second", () => {
    expect(withAssignedFilter("assigned:me is:resolved", "none")).toBe(
      "is:resolved assigned:none",
    );
  });

  it("removes the term for null", () => {
    expect(withAssignedFilter("is:unresolved assigned:me", null)).toBe(
      "is:unresolved",
    );
  });
});

describe("assignedValueFor", () => {
  it("uses #slug for a team and the email for a person", () => {
    expect(
      assignedValueFor({
        type: "team",
        id: "9",
        name: "platform",
        slug: "platform",
      }),
    ).toBe("#platform");
    expect(
      assignedValueFor({
        type: "user",
        id: "2",
        name: "Ana",
        email: "ana@acme.test",
      }),
    ).toBe("ana@acme.test");
  });
});
