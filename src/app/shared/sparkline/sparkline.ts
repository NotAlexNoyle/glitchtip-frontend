import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  input,
  signal,
} from "@angular/core";
import { AreaChartStackedComponent } from "@glitchtip/ng-charts";

export interface SparklineDataPoint {
  name: Date;
  value: number;
}

export interface SparklineSeries {
  name: string;
  series: SparklineDataPoint[];
}

const CHART_HEIGHT = 60;

@Component({
  selector: "gt-sparkline",
  imports: [AreaChartStackedComponent],
  template: `
    <div #containerRef class="sparkline-container" [style.height.px]="height()">
      <ng-charts-area-chart-stacked
        [showXAxisLabel]="false"
        [showYAxisLabel]="false"
        [xAxis]="true"
        [yAxis]="false"
        [gradient]="true"
        [animations]="false"
        [legend]="showLegend()"
        [tooltipDisabled]="false"
        [view]="view()"
        [customColors]="customColors()"
        [results]="chartResults()"
      >
        <ng-template #tooltipTemplate let-model="model">
          {{ model.value }} events
        </ng-template>
      </ng-charts-area-chart-stacked>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }
    .sparkline-container {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparklineComponent implements OnDestroy {
  /** Single series mode */
  data = input<SparklineDataPoint[]>([]);
  /** Multi-series (stacked) mode */
  multiSeries = input<SparklineSeries[]>();
  /** Custom color mapping */
  colors = input<{ name: string; value: string }[]>();
  showLegend = input(false);
  height = input(CHART_HEIGHT);

  private resizeObserver?: ResizeObserver;
  private _containerRef?: ElementRef<HTMLDivElement>;
  view = signal<[number, number]>([0, 60]);

  chartResults = computed(() => {
    const multi = this.multiSeries();
    if (multi?.length) return multi;

    const points = this.data();
    if (!points.length) return [];
    return [{ name: "Events", series: points }];
  });

  customColors = computed(() => {
    const custom = this.colors();
    if (custom?.length) return custom;

    return [{ name: "Events", value: "var(--mat-sys-secondary)" }];
  });

  @ViewChild("containerRef")
  set containerRef(element: ElementRef<HTMLDivElement> | undefined) {
    if (element) {
      this._containerRef = element;
      this.initializeResizeObserver();
    } else if (this._containerRef) {
      this.resizeObserver?.disconnect();
      this._containerRef = undefined;
    }
  }

  private initializeResizeObserver(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      this.view.set([width, height]);
    });
    if (this._containerRef) {
      this.resizeObserver.observe(this._containerRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}
