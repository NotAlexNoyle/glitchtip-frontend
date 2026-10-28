import { describe, expect, it } from "vitest";
import { holdWhileLoading, LoadedEvent } from "./issue-detail.service";

const loaded = (
  value: string | null | undefined,
  loading = false,
  issueID = "1",
): LoadedEvent<string> => ({ value, loading, issueID });

describe("holdWhileLoading", () => {
  it("keeps the shown event while the next one of the same issue loads", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(holdWhileLoading(loaded(undefined, true), prev)).toBe("a");
  });

  it("shows the next event once it has loaded", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(holdWhileLoading(loaded("b"), prev)).toBe("b");
  });

  it("does not carry an event over to another issue", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(
      holdWhileLoading(loaded(undefined, true, "2"), prev),
    ).toBeUndefined();
  });

  it("shows not found (null) rather than the previous event", () => {
    const prev = { source: loaded("a"), value: "a" };
    expect(holdWhileLoading(loaded(null), prev)).toBeNull();
  });
});
