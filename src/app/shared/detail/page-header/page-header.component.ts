import { ChangeDetectionStrategy, Component, input } from "@angular/core";

/**
 * gt-page-header — the lightweight header for settings-style detail pages
 * (member, project, team): an emphasized entity title over a hairline rule, with
 * an optional uppercase kicker above and a quiet meta line below. No card and no
 * vitals — it is the counterpart to gt-detail-masthead, which is reserved for
 * data-rich pages that actually have a metrics cluster. The presence of the
 * masthead card (vitals) vs. this bare header is the signal that tells a
 * "dashboard" detail page apart from a "settings" one.
 *
 * Project as an action slot on the right (e.g. a settings button) via ng-content.
 */
@Component({
  selector: "gt-page-header",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./page-header.component.html",
  styleUrl: "./page-header.component.scss",
})
export class PageHeaderComponent {
  readonly title = input<string>("");
  readonly kicker = input<string | null>(null);
  readonly meta = input<string | null>(null);
  readonly titleMono = input(false);
}
