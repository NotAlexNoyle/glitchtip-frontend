import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/**
 * gt-percent — the canonical representation of the *percentage* attribute type
 * (uptime, error rate, usage…). Fixed decimals and tabular figures so percentages
 * read and align consistently, with the "%" always attached the same way.
 *
 * Takes a value already on a 0–100 scale (the app computes these upstream).
 * Before this, percentages were rendered as raw `x%`, `| percent`, and varying
 * decimal specs.
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
  /** The percentage, already on a 0–100 scale. */
  readonly value = input.required<number | null | undefined>();
  /** Decimal places. Default 1. */
  readonly decimals = input(1);

  readonly display = computed(() => {
    const n = this.value();
    if (n === null || n === undefined || !Number.isFinite(n)) return "";
    return `${n.toFixed(this.decimals())}%`;
  });
}
