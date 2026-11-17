import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
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
        },
      },
    ],
  });
  return TestBed.createComponent(AssigneePickerComponent).componentInstance;
}

describe("AssigneePickerComponent", () => {
  it("keeps me out of Members, since Assign to me covers it", () => {
    const picker = setup();
    expect(picker.members().map((m) => m.actor.name)).toEqual(["Ana Ruiz"]);
    expect(picker.showMe()).toBe(true);
  });

  it("filters people by name or email and teams by slug", () => {
    const picker = setup();
    picker.query.set("ana@");
    expect(picker.members().length).toBe(1);
    expect(picker.teams().length).toBe(0);
    expect(picker.showMe()).toBe(false);
    picker.query.set("PLAT");
    expect(picker.teams().length).toBe(1);
    expect(picker.members().length).toBe(0);
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
});
