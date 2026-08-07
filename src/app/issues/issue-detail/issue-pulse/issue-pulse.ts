import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from "@angular/core";
import { AreaChartComponent } from "@glitchtip/ng-charts";

interface PulseMarker {
  i: number;
  label: string;
  kind: "release" | "first-seen";
}

/**
 * PROTOTYPE pulse — the issue's frequency over time as a slim "vital sign",
 * richer than the list's 24h/14d bar chart: a longer daily history with release
 * and first-seen markers so a spike lines up with a deploy (regression at a
 * glance).
 *
 * The AREA/LINE is drawn by the charting library we already ship
 * (@glitchtip/ng-charts `AreaChartComponent`). Only the vertical release /
 * first-seen markers are custom, because the library only does horizontal
 * reference lines. The markers are positioned off the chart's *measured* plot
 * geometry (not a hardcoded margin), so they stay aligned across widths and
 * survive library margin changes.
 *
 * Data is MOCKED (the real API returns only 24h/14d buckets); wire to a real
 * daily time series + the releases API for production.
 */
@Component({
  selector: "gt-issue-pulse",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AreaChartComponent],
  template: `
    <div class="pulse-wrap">
      <div class="pulse-chart">
        <ng-charts-area-chart
          [results]="results()"
          [customColors]="colors()"
          [xAxis]="false"
          [yAxis]="false"
          [gradient]="true"
          [showGridLines]="false"
          [timeline]="false"
          [animations]="false"
          [tooltipDisabled]="true"
          [roundDomains]="false"
        ></ng-charts-area-chart>
      </div>
      <div class="pulse-overlay">
        @for (m of markers(); track m.i) {
          <span
            [class]="'pulse-tick pulse-tick--' + m.kind"
            [style.left.px]="markerLeft(m.i)"
          ></span>
        }
      </div>
      <div class="pulse-labels">
        @for (m of markers(); track m.i) {
          <span
            [class]="'pulse-label pulse-label--' + m.kind"
            [style.left.px]="markerLeft(m.i)"
            >{{ m.label }}</span
          >
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .pulse-wrap {
        position: relative;
      }
      .pulse-chart {
        height: 52px;
      }
      /* strip the library's default text/axis chrome for the vital-sign look */
      .pulse-chart ::ng-deep .ngx-charts text {
        display: none;
      }
      .pulse-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .pulse-tick {
        position: absolute;
        top: 0;
        height: 52px;
        width: 0;
        transform: translateX(-50%);
        border-left: 1px solid;
      }
      .pulse-tick--release {
        border-left-style: dashed;
        border-left-color: var(--mat-sys-on-surface-variant);
        opacity: 0.55;
      }
      .pulse-tick--first-seen {
        border-left-color: var(--mat-sys-primary);
        opacity: 0.7;
      }
      .pulse-labels {
        position: relative;
        height: 16px;
        margin-top: 2px;
      }
      .pulse-label {
        position: absolute;
        transform: translateX(-50%);
        white-space: nowrap;
        font: var(--mat-sys-label-small);
        font-family: var(--gt-font-mono, monospace);
        color: var(--mat-sys-on-surface-variant);
        letter-spacing: 0.02em;
      }
      .pulse-label--first-seen {
        color: var(--mat-sys-primary);
      }
    `,
  ],
})
export class IssuePulse {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private destroyRef = inject(DestroyRef);

  readonly days = input(45);
  // Series color tracks the theme's primary accent. Resolved from the CSS token
  // in afterNextRender (the chart lib needs a concrete string); the fallback
  // matches --mat-sys-primary so it is on-system before resolution and in SSR.
  readonly colors = signal([{ name: "Events", value: "#d94a5f" }]);

  // Measured plot geometry (px, relative to .pulse-wrap) — markers align to the
  // drawn curve rather than a guessed library margin.
  private plot = signal<{ left: number; width: number }>({ left: 0, width: 0 });

  constructor() {
    afterNextRender(() => {
      const primary = getComputedStyle(this.host.nativeElement)
        .getPropertyValue("--mat-sys-primary")
        .trim();
      if (primary) this.colors.set([{ name: "Events", value: primary }]);
      this.measureSoon();
      const ro = new ResizeObserver(() => this.measure());
      ro.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  // Retry a few frames: the library draws its <path> a frame or two after render.
  private measureSoon(tries = 5): void {
    requestAnimationFrame(() => {
      if (!this.measure() && tries > 0) this.measureSoon(tries - 1);
    });
  }

  private measure(): boolean {
    const root = this.host.nativeElement;
    const wrap = root.querySelector<HTMLElement>(".pulse-wrap");
    const path = root.querySelector<SVGPathElement>("ng-charts-area-chart svg path");
    if (!wrap || !path) return false;
    const p = path.getBoundingClientRect();
    if (!p.width) return false;
    const w = wrap.getBoundingClientRect();
    this.plot.set({ left: p.left - w.left, width: p.width });
    return true;
  }

  markerLeft(i: number): number {
    const { left, width } = this.plot();
    const n = this.days();
    const frac = n <= 1 ? 0 : i / (n - 1);
    return left + frac * width;
  }

  private series = computed(() => {
    const n = this.days();
    const spikeCenter = Math.round(n * 0.78);
    return Array.from({ length: n }, (_, i) => {
      let value: number;
      if (i < spikeCenter) {
        value = i % 7 === 0 ? 3 : (i * 3) % 4;
      } else {
        const d = i - spikeCenter;
        value = Math.max(2, Math.round(42 * Math.exp(-(d * d) / 18)));
      }
      return { name: i.toString(), value };
    });
  });

  readonly results = computed(() => [{ name: "Events", series: this.series() }]);

  readonly markers = computed<PulseMarker[]>(() => {
    const n = this.days();
    return [
      { i: Math.round(n * 0.4), label: "v2.3.9", kind: "release" },
      { i: Math.round(n * 0.6), label: "first seen", kind: "first-seen" },
      { i: Math.round(n * 0.76), label: "v2.4.1", kind: "release" },
    ];
  });
}
