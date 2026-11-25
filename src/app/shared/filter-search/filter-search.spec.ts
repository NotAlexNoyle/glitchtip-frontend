// Type-only: declares the $localize global for the spec program. The runtime
// polyfill is already loaded by the test builder.
import type {} from "@angular/localize/init";
import { describe, expect, it } from "vitest";
import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { FilterSearchComponent } from "./filter-search";

@Component({
  imports: [ReactiveFormsModule, FilterSearchComponent],
  template: `<form
    gtFilterSearch
    [formGroup]="form"
    [control]="form.controls.query"
    label="Search"
    [active]="active()"
    (cleared)="clears = clears + 1"
  ></form>`,
})
class HostComponent {
  form = new FormGroup({ query: new FormControl("") });
  active = signal(false);
  clears = 0;
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el: HTMLElement = fixture.nativeElement;
  const clearButton = () =>
    el.querySelector<HTMLButtonElement>("[data-cy=list-search-clear]");
  return { fixture, host: fixture.componentInstance, el, clearButton };
}

describe("FilterSearchComponent", () => {
  it("shows clear only when there is text or a band filter", () => {
    const { fixture, host, clearButton } = setup();
    expect(clearButton()).toBeNull();

    host.form.controls.query.setValue("is:resolved");
    fixture.detectChanges();
    expect(clearButton()).not.toBeNull();

    host.form.controls.query.setValue("   ");
    fixture.detectChanges();
    expect(clearButton()).toBeNull();

    host.active.set(true);
    fixture.detectChanges();
    expect(clearButton()).not.toBeNull();
  });

  it("reports a clear and keeps focus in the field", () => {
    const { fixture, host, el, clearButton } = setup();
    host.form.controls.query.setValue("timeout");
    fixture.detectChanges();

    clearButton()!.click();
    expect(host.clears).toBe(1);
    expect(document.activeElement).toBe(
      el.querySelector("[data-cy=list-search-field]"),
    );
  });
});
