import { Component, ChangeDetectionStrategy, input } from "@angular/core";

/**
 * gt-stat — one labeled metric: a value (tabular figure or short string) over a
 * muted caption label. The shared "stat row" primitive the design system names
 * but hadn't shipped; compose several with whitespace for a metric cluster.
 *
 * Pass `value`, or project content into the value slot for a styled value
 * (e.g. a severity-coloured level).
 */
@Component({
  selector: "gt-stat",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="stat__value" [class.stat__value--mono]="mono()">
      @if (hasValue) {
        {{ value() }}
      } @else {
        <ng-content />
      }
    </span>
    <span class="stat__label">{{ label() }}</span>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }
      .stat__value {
        font: var(--mat-sys-title-medium);
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        line-height: 1.15;
        color: var(--mat-sys-on-surface);
      }
      .stat__value--mono {
        font-family: var(--gt-font-mono, monospace);
        font-weight: 600;
      }
      .stat__label {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class StatComponent {
  readonly value = input<string | number | null | undefined>();
  readonly label = input<string>("");
  readonly mono = input(false);

  get hasValue() {
    const v = this.value();
    return v !== undefined && v !== null && v !== "";
  }
}
