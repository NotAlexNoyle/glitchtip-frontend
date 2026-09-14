import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

/**
 * gt-count — the canonical representation of the *count* attribute type: a
 * cardinal number (events, users, issues…). Tabular figures so columns of counts
 * align, and abbreviated at scale (1.2k, 3.4M) so a big number stays scannable.
 *
 * OOUX (the "A" pillar, by attribute type): a count is a count wherever it
 * appears, so it should format and align the same way on every object. Before
 * this, counts used `| number` with inconsistent decimals and no tabular
 * alignment or abbreviation.
 */
@Component({
  selector: "gt-count",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="gt-count" [title]="exact()">{{ display() }}</span>`,
  styles: `
    .gt-count {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CountComponent {
  /** The count (number, or a numeric string as the API often returns). */
  readonly value = input.required<number | string | null | undefined>();
  /** Abbreviate large values (1.2k / 3.4M / 1.2B). Default true. */
  readonly abbreviate = input(true);

  readonly #num = computed(() => {
    const n = Number(this.value());
    return Number.isFinite(n) ? n : null;
  });

  /** Full value in the tooltip when the display is abbreviated. */
  readonly exact = computed(() => {
    const n = this.#num();
    if (n === null) return null;
    return this.display() !== n.toLocaleString() ? n.toLocaleString() : null;
  });

  readonly display = computed(() => {
    const n = this.#num();
    if (n === null) return "";
    if (!this.abbreviate() || Math.abs(n) < 1000) return n.toLocaleString();
    const units: [number, string][] = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "k"],
    ];
    for (const [factor, suffix] of units) {
      if (Math.abs(n) >= factor) {
        const scaled = n / factor;
        // One decimal, but drop a trailing .0 (1.0k -> 1k).
        return scaled.toFixed(1).replace(/\.0$/, "") + suffix;
      }
    }
    return n.toLocaleString();
  });
}
