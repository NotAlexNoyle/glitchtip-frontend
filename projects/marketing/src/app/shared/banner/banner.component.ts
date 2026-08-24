import {
  Component,
  ChangeDetectionStrategy,
  ViewEncapsulation,
} from "@angular/core";

/**
 * Full-width standout band with a faded line-grid texture; projected content
 * sits in a centred, width-capped column.
 */
@Component({
  selector: "mkt-banner",
  template: `<div class="banner">
    <span class="banner__cells banner__cells--1" aria-hidden="true"></span>
    <span class="banner__cells banner__cells--2" aria-hidden="true"></span>
    <span class="banner__cells banner__cells--3" aria-hidden="true"></span>
    <span class="banner__cells banner__cells--4" aria-hidden="true"></span>
    <div class="banner__inner"><ng-content /></div>
  </div>`,
  styleUrl: "./banner.component.scss",
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.Emulated,
})
export class BannerComponent {}
