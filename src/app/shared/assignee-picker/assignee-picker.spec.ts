import type {} from "@angular/localize/init";
import { describe, expect, it, vi } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import {
  AssigneeOption,
  AssigneeOptionsService,
} from "./assignee-options.service";
import { AssigneePickerComponent } from "./assignee-picker";

const person = (id: string, name: string, email: string, isMe = false) =>
  ({
    value: `user:${id}`,
    isMe,
    actor: { type: "user", id, name, email },
  }) as AssigneeOption;

function setup() {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AssigneeOptionsService,
        useValue: {
          members: signal([
            person("1", "Me", "me@acme.test", true),
            person("2", "Ana Ruiz", "ana@acme.test"),
          ]),
          teams: signal([
            {
              value: "team:platform",
              isMe: false,
              actor: {
                type: "team",
                id: "9",
                name: "platform",
                slug: "platform",
              },
            },
          ]),
          me: signal(person("1", "Me", "me@acme.test", true)),
          loading: signal(false),
          load: vi.fn(),
        },
      },
    ],
  });
  return TestBed.createComponent(AssigneePickerComponent).componentInstance;
}

describe("AssigneePickerComponent", () => {
  it("keeps me out of Members, since Assign to me covers it", () => {
    const picker = setup();
    expect(picker.list().members.map((m) => m.actor.name)).toEqual([
      "Ana Ruiz",
    ]);
    expect(picker.showMe()).toBe(true);
  });

  it("filters people by name or email and teams by slug", () => {
    const picker = setup();
    picker.query.set("ana@");
    expect(picker.list().members.length).toBe(1);
    expect(picker.list().teams.length).toBe(0);
    expect(picker.showMe()).toBe(false);
    picker.query.set("PLAT");
    expect(picker.list().teams.length).toBe(1);
    expect(picker.list().members.length).toBe(0);
  });

  it("says so when nothing matches", () => {
    const picker = setup();
    picker.query.set("nobody");
    expect(picker.noMatches()).toBe(true);
  });

  it("emits null to unassign", () => {
    const picker = setup();
    let picked: unknown;
    picker.picked.subscribe((choice) => (picked = choice));
    picker.pick(null);
    expect(picked).toEqual({ value: null, actor: null });
  });

  it("keeps typing out of the menu but lets Tab close it", () => {
    const picker = setup();
    const key = (k: string) => {
      const event = new KeyboardEvent("keydown", { key: k });
      const stop = vi.spyOn(event, "stopPropagation");
      picker.onFilterKeydown(event);
      return stop;
    };
    expect(key("a")).toHaveBeenCalled();
    expect(key("Tab")).not.toHaveBeenCalled();
  });

  it("starts loading people when opened", () => {
    const picker = setup();
    picker.loadOptions();
    expect(TestBed.inject(AssigneeOptionsService).load).toHaveBeenCalled();
  });
});
