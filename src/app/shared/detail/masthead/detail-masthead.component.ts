import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { DetailHeaderComponent } from "../header/header.component";

/**
 * gt-detail-masthead — the shared detail-page header module: a leading status
 * indicator, the entity title (emphasized, with an optional quiet subtitle), a
 * vitals cluster, and a full-width "pulse" strip. It owns the layout and
 * hierarchy so every detail page (issue, monitor, ...) reads as one system;
 * each page projects its own status indicator, vitals (gt-stat), and pulse.
 *
 * Slots:
 * - `[slot=status]`   the status indicator (icon/bar), page-specific.
 * - `[slot=identity]` optional extra line under the title (e.g. "Up for 18m").
 * - `[slot=vitals]`   the gt-stat metric cluster.
 * - `[slot=pulse]`    a full-width chart/strip below the identity + vitals.
 *
 * `title` accepts a `[title, suffix]` tuple (the suffix renders quiet inline,
 * e.g. an error culprit). `subtitle` is the supporting line under the title;
 * set `subtitleMono` when it is a machine identifier (e.g. a monitored URL).
 */
@Component({
  selector: "gt-detail-masthead",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DetailHeaderComponent],
  templateUrl: "./detail-masthead.component.html",
  styleUrl: "./detail-masthead.component.scss",
})
export class DetailMastheadComponent {
  readonly title = input<string | [string, string | null]>("");
  readonly subtitle = input<string | null>(null);
  readonly subtitleMono = input(false);
}
