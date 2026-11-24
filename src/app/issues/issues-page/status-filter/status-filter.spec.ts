import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { TestBed } from "@angular/core/testing";
import { StatusFilterComponent } from "./status-filter";

function setup(value: string | null) {
  const fixture = TestBed.createComponent(StatusFilterComponent);
  fixture.componentRef.setInput("value", value);
  const filter = fixture.componentInstance;
  const emitted: (string | null)[] = [];
  filter.changed.subscribe((v) => emitted.push(v));
  return { filter, emitted };
}

describe("StatusFilterComponent", () => {
  it("names the current status, or All statuses without an is: term", () => {
    expect(setup("resolved").filter.labelFor("resolved")).toBe("Resolved");
    expect(setup(null).filter.labelFor(null)).toBe("All statuses");
  });

  it("emits null for All statuses and nothing when the value is unchanged", () => {
    const { filter, emitted } = setup("resolved");
    filter.pick("all");
    filter.pick("resolved");
    expect(emitted).toEqual([null]);
  });
});
