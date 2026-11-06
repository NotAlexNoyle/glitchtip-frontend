import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/** Drifting line grid with red pings; `pane` keeps it strong, `still` stops it. */
@Component({
  selector: "mkt-grid-drift",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "aria-hidden": "true",
    "[class.is-pane]": "pane()",
    "[class.is-still]": "still()",
  },
  template: `<div class="lines">
    <i class="ping" style="--x: -6; --y: -5; --d: 0.5s"></i>
    <i class="ping" style="--x: 9; --y: 1; --d: 3.7s"></i>
    <i class="ping" style="--x: -3; --y: 5; --d: 6.9s"></i>
    <i class="ping" style="--x: 5; --y: -4; --d: 10.1s"></i>
    <i class="ping" style="--x: -10; --y: 0; --d: 13.3s"></i>
  </div>`,
  styleUrl: "./grid-drift.component.scss",
})
export class GridDriftComponent {
  pane = input(false);
  still = input(false);
}
