import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatTooltipModule } from "@angular/material/tooltip";

/**
 * The list band's search field, on the page's own form. Its clear button
 * empties the search and the band's filters, so it shows only when there is
 * something to clear.
 * Content (Syntax help) goes after the clear button; see .gt-filter-search.
 */
@Component({
  // An attribute on the page's own <form>, so its formGroup and submit stay there.
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: "form[gtFilterSearch]",
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
  ],
  template: `
    <mat-icon class="gt-filter-search__icon" aria-hidden="true"
      >search</mat-icon
    >
    <input
      #field
      class="gt-filter-search__input"
      type="search"
      [formControl]="control()"
      [attr.aria-label]="label()"
      [attr.placeholder]="placeholder()"
      data-cy="list-search-field"
    />
    @if (showClear()) {
      <button
        mat-icon-button
        type="button"
        class="gt-filter-search__clear"
        i18n-aria-label
        aria-label="Clear filters"
        i18n-matTooltip
        matTooltip="Clear filters"
        (click)="clear()"
        data-cy="list-search-clear"
      >
        <mat-icon>close</mat-icon>
      </button>
    }
    <ng-content />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "gt-filter-bar__search gt-filter-search" },
})
export class FilterSearchComponent {
  readonly control = input.required<FormControl<string | null>>();
  readonly label = input.required<string>();
  readonly placeholder = input<string>();
  /** A band filter outside the search is set. */
  readonly active = input(false);
  readonly cleared = output();

  // The field's text, typed or set by the page.
  private readonly text = signal("");
  protected readonly showClear = computed(
    () => this.active() || this.text().trim() !== "",
  );
  private readonly field =
    viewChild.required<ElementRef<HTMLInputElement>>("field");

  constructor() {
    effect((onCleanup) => {
      const control = this.control();
      this.text.set(control.value ?? "");
      const sub = control.valueChanges.subscribe((value) =>
        this.text.set(value ?? ""),
      );
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected clear() {
    this.cleared.emit();
    // The button goes away; keep focus in the field.
    this.field().nativeElement.focus();
  }
}
