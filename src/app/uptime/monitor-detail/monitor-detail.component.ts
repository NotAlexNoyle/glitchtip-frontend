import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  computed,
  input,
  booleanAttribute,
  signal,
  effect,
} from "@angular/core";
import { MonitorState, MonitorService } from "../monitor.service";
import { RouterModule } from "@angular/router";
import { CopyInputComponent } from "src/app/shared/copy-input/copy-input.component";
import { MatCardModule } from "@angular/material/card";
import { MatDividerModule } from "@angular/material/divider";
import { MonitorChecks } from "../monitor-checks/monitor-checks";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MonitorResponseChart } from "../monitor-response-chart/monitor-response-chart";
import { MonitorChartComponent } from "../monitor-chart/monitor-chart.component";
import { TimeForPipe } from "src/app/shared/days-ago.pipe";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { DetailMastheadComponent } from "src/app/shared/detail/masthead/detail-masthead.component";
import { StatComponent } from "src/app/shared/stat/stat.component";
import { HumanizeDurationPipe } from "src/app/shared/seconds-or-ms.pipe";
import { StatefulComponent } from "src/app/shared/stateful-service/signal-state.component";
import { DecimalPipe } from "@angular/common";
import { TopAppBar } from "src/app/shared/top-app-bar/top-app-bar";
import { BackLinkComponent } from "src/app/shared/detail/back-link/back-link.component";
import { BreakpointObserver, Breakpoints } from "@angular/cdk/layout";
import { toSignal } from "@angular/core/rxjs-interop";
import { monitorStatusToken } from "src/app/shared/object-identity/object-identity";
import { ObjectRefComponent } from "src/app/shared/object-identity/object-ref.component";

function booleanDefaultTrueAttribute(value: unknown): boolean {
  return value === undefined ? true : booleanAttribute(value);
}

@Component({
  selector: "gt-monitor-detail",
  templateUrl: "./monitor-detail.component.html",
  styleUrls: ["./monitor-detail.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    MonitorChecks,
    CopyInputComponent,
    MonitorResponseChart,
    TimeForPipe,
    DecimalPipe,
    MatButtonModule,
    MonitorChartComponent,
    MatCardModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatIconModule,
    DetailMastheadComponent,
    StatComponent,
    HumanizeDurationPipe,
    TopAppBar,
    BackLinkComponent,
    ObjectRefComponent,
  ],
})
export class MonitorDetailComponent
  extends StatefulComponent<MonitorState, MonitorService>
  implements OnInit
{
  protected service: MonitorService;
  private breakpointObserver = inject(BreakpointObserver);

  orgSlug = input.required<string>({ alias: "org-slug" });
  monitorID = input.required<number>({ alias: "monitor-id" });
  isChange = input.required({ transform: booleanDefaultTrueAttribute });
  cursor = input<string | undefined>();

  monitor = this.service.activeMonitor;
  uptimeAlertCount = this.service.uptimeAlertCount;
  alertCountLoading = this.service.alertCountLoading;
  associatedProjectSlug = this.service.associatedProjectSlug;

  isMobile = signal(false);
  private smallBreakpointSignal = toSignal(
    this.breakpointObserver.observe([Breakpoints.Small, Breakpoints.XSmall]),
  );

  activeMonitorRecentChecksSeries =
    this.service.activeMonitorRecentChecksSeries;
  responseChartScale = computed(() => {
    const series = this.service.activeMonitorRecentChecksSeries();
    let yScaleMax = 20;
    let xScaleMin = new Date();
    xScaleMin.setHours(xScaleMin.getHours() - 1);

    series?.forEach((subseries) => {
      subseries.series.forEach((dataItem) => {
        if (dataItem.value > yScaleMax) {
          yScaleMax = dataItem.value;
        }
        if (dataItem.name < xScaleMin) {
          xScaleMin = dataItem.name;
        }
      });
    });

    return {
      yScaleMax,
      yScaleMin: 0 - yScaleMax / 6,
      xScaleMin,
    };
  });

  // Vitals derived from the recent checks, shown as gt-stat in the masthead so
  // the monitor detail reads with the same identity+vitals+pulse hierarchy as
  // the issue detail page.
  uptimePercent = computed<number | null>(() => {
    const checks = this.monitor()?.checks ?? [];
    if (!checks.length) return null;
    const ups = checks.filter((c) => c.isUp).length;
    return (100 * ups) / checks.length;
  });

  avgResponseTime = computed<number | null>(() => {
    const checks = (this.monitor()?.checks ?? []) as {
      isUp: boolean;
      responseTime?: number;
    }[];
    const timed = checks.filter((c) => c.isUp && c.responseTime);
    if (!timed.length) return null;
    return Math.round(
      timed.reduce((sum, c) => sum + (c.responseTime ?? 0), 0) / timed.length,
    );
  });

  // Monitor identity now comes from the shared object-identity token, so the
  // masthead, list row, checks table, and mini-chart all colour, icon, and
  // label a monitor's up/down/no-data state from one source.
  statusToken = computed(() => monitorStatusToken(this.monitor()?.isUp));
  statusLabel = computed<string>(() => this.statusToken().label);

  constructor() {
    const service = inject(MonitorService);
    super(service);
    this.service = service;

    effect(() => {
      const breakpointResult = this.smallBreakpointSignal();
      if (breakpointResult?.matches) {
        this.isMobile.set(true);
      } else {
        this.isMobile.set(false);
      }
    });
  }

  ngOnInit() {
    this.service.retrieveMonitorDetails(this.monitorID());
  }

  delete() {
    if (
      window.confirm(
        `Are you sure you want delete this monitor? You will permanently lose all associated uptime data.`,
      )
    ) {
      this.service.deleteMonitor();
    }
  }
}
