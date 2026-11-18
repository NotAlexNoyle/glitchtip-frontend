import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  AssigneeOption,
  AssigneeOptionsService,
} from "src/app/shared/assignee-picker/assignee-options.service";
import { AssigneeFilterComponent } from "./assignee-filter";

const person = {
  value: "user:2",
  isMe: false,
  actor: { type: "user", id: "2", name: "Ana Ruiz", email: "ana@acme.test" },
} as AssigneeOption;
const team = {
  value: "team:platform",
  isMe: false,
  actor: { type: "team", id: "9", name: "platform", slug: "platform" },
} as AssigneeOption;

function setup(value: string | null = null) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AssigneeOptionsService,
        useValue: { members: signal([person]), teams: signal([team]) },
      },
    ],
  });
  const fixture = TestBed.createComponent(AssigneeFilterComponent);
  fixture.componentRef.setInput("value", value);
  return fixture.componentInstance;
}

describe("AssigneeFilterComponent", () => {
  it("names a value, not the raw term, so a pick never shows 'me'", () => {
    const filter = setup();
    expect(filter.labelFor("me")).toBe("Assigned to me");
    expect(filter.labelFor("#platform")).toBe("#platform");
    expect(filter.labelFor("ana@acme.test")).toBe("Ana Ruiz");
    expect(filter.labelFor(null)).toBe("");
  });

  it("shows the current filter while you are not typing", () => {
    const filter = setup("#platform");
    expect(filter.text()).toBe("#platform");
    filter.typed.set("an");
    expect(filter.text()).toBe("an");
  });

  it("keeps Anyone when nothing matches, so the panel stays open", () => {
    const filter = setup();
    filter.typed.set("zzz");
    expect(filter.visibleShortcuts().map((s) => s.value)).toEqual([null]);
    expect(filter.noMatches()).toBe(true);
  });

  it("only reports a change when the value is different", () => {
    const filter = setup("me");
    const changes: (string | null)[] = [];
    filter.changed.subscribe((v) => changes.push(v));
    filter.select("me");
    filter.select("none");
    expect(changes).toEqual(["none"]);
  });
});
