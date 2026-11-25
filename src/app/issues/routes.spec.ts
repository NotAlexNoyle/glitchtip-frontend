import { describe, expect, it } from "vitest";
import { UrlSegment } from "@angular/router";
import { eventMatcher } from "./routes";

const segments = (...paths: string[]) =>
  paths.map((path) => new UrlSegment(path, {}));

describe("eventMatcher", () => {
  it("matches the latest event", () => {
    expect(eventMatcher(segments())).toEqual({ consumed: [] });
  });

  it("matches a picked event and passes its id", () => {
    const match = eventMatcher(segments("events", "abc"));
    expect(match?.posParams?.["event-id"].path).toBe("abc");
  });

  it("leaves the other tabs to their own routes", () => {
    expect(eventMatcher(segments("comments"))).toBeNull();
    expect(eventMatcher(segments("events"))).toBeNull();
  });
});
