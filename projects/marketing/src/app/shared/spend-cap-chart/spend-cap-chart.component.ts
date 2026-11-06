import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
} from "@angular/core";

/** Usage climbs past the plan (red is billed) and stops at the cap; draws once. */
@Component({
  selector: "mkt-spend-cap-chart",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./spend-cap-chart.component.html",
  styleUrl: "./spend-cap-chart.component.scss",
})
export class SpendCapChartComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const node = this.host.nativeElement;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      node.classList.add("is-armed");
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            node.classList.add("is-drawn");
            observer.disconnect();
          }
        },
        { threshold: 0.6 },
      );
      observer.observe(node);
    });
  }
}
