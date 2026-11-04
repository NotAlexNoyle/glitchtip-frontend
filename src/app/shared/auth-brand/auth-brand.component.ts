import { ChangeDetectionStrategy, Component } from "@angular/core";

/**
 * The left pane on logged-out pages: the G mark, one two-tone statement on a faded,
 * slowly drifting patch of grid. Hidden on narrow screens.
 */
@Component({
  selector: "gt-auth-brand",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "auth-brand", "aria-hidden": "true" },
  template: `
    <img
      class="auth-brand__logo"
      src="static/assets/images/glitchtip-logo-collasped.svg"
      alt=""
    />
    <div class="auth-brand__copy">
      <div class="auth-brand__grid">
        <div class="auth-brand__lines">
          <i class="auth-brand__ping" style="--x: -6; --y: -5; --d: 0.5s"></i>
          <i class="auth-brand__ping" style="--x: 9; --y: 1; --d: 3.7s"></i>
          <i class="auth-brand__ping" style="--x: -3; --y: 5; --d: 6.9s"></i>
          <i class="auth-brand__ping" style="--x: 5; --y: -4; --d: 10.1s"></i>
          <i class="auth-brand__ping" style="--x: -10; --y: 0; --d: 13.3s"></i>
        </div>
      </div>
      <p class="auth-brand__statement">
        <strong><ng-content select="[slot=lead]" /></strong>
        <ng-content select="[slot=rest]" />
      </p>
    </div>
  `,
})
export class AuthBrandComponent {}
