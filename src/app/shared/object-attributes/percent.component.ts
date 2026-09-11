import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

/**
 * Renders a percentage with fixed decimals, so a column of percentages aligns
 * and the "%" always attaches the same way.
 */
@Component({
  selector: "gt-percent",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="gt-percent">{{ display() }}</span>`,
  styles: `
    .gt-percent {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class PercentComponent {
  /** On a 0-100 scale, not a 0-1 fraction. */
  readonly value = input.required<number | null | undefined>();
  /** Decimal places. Default 1. */
  readonly decimals = input(1);

  readonly display = computed(() => {
    const n = this.value();
    if (n === null || n === undefined || !Number.isFinite(n)) return "";
    return `${n.toFixed(this.decimals())}%`;
  });
}
