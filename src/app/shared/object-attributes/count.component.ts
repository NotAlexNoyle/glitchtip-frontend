import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

/**
 * Renders a cardinal count (events, users, issues). Large values abbreviate,
 * keeping the exact value on hover. Pair with a right-aligned column so the
 * digits line up.
 */
/** Below this, exact digits still matter when comparing two counts. */
const ABBREVIATE_ABOVE = 10_000;

@Component({
  selector: "gt-count",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="gt-count" [title]="exact()">{{ display() }}</span>`,
  styles: `
    .gt-count {
      // Plex Sans already has tabular figures; this holds if the font changes.
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CountComponent {
  readonly value = input.required<number | string | null | undefined>();
  /** Abbreviate above ABBREVIATE_ABOVE (45.6k, 1.2M). */
  readonly abbreviate = input(true);

  readonly #num = computed(() => {
    const n = Number(this.value());
    return Number.isFinite(n) ? n : null;
  });

  /** Tooltip value, only when the display is abbreviated. */
  readonly exact = computed(() => {
    const n = this.#num();
    if (n === null) return null;
    return this.display() !== n.toLocaleString() ? n.toLocaleString() : null;
  });

  readonly display = computed(() => {
    const n = this.#num();
    if (n === null) return "";
    if (!this.abbreviate() || Math.abs(n) < ABBREVIATE_ABOVE)
      return n.toLocaleString();
    // Use the largest unit the value actually reaches. Rounding to one decimal
    // can push the mantissa to 1000 (999,999 -> "1000k"), so in that one case
    // step up a unit; otherwise the unit is chosen by magnitude alone.
    const units: [number, string][] = [
      [1e9, "B"],
      [1e6, "M"],
      [1e3, "k"],
    ];
    for (let i = 0; i < units.length; i++) {
      const [factor, suffix] = units[i];
      if (Math.abs(n) < factor) continue;
      let scaled = Number((n / factor).toFixed(1));
      let unit = suffix;
      if (Math.abs(scaled) >= 1000 && i > 0) {
        [, unit] = units[i - 1];
        scaled = Number((n / units[i - 1][0]).toFixed(1));
      }
      // One decimal, but drop a trailing .0 (10.0k -> 10k).
      return scaled.toFixed(1).replace(/\.0$/, "") + unit;
    }
    return n.toLocaleString();
  });
}
