import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatCardModule } from "@angular/material/card";

/**
 * gt-object-card — the "aggregate glance": a collection of one object type
 * summarised in an outlined card, navigable to that object's list/detail.
 *
 * Deliberately icon-less: the eyebrow label already names the object, so an
 * identity glyph beside it would be decoration (icon-restraint audit — an icon
 * should do a job the label doesn't; here it doesn't). Object identity on this
 * surface is carried by the label, the link, and the projected content.
 */
@Component({
  selector: "gt-object-card",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatCardModule],
  templateUrl: "./object-card.component.html",
  styleUrl: "./object-card.component.scss",
})
export class ObjectCardComponent {
  /** Eyebrow label. */
  readonly title = input.required<string>();
  /** RouterLink target for the whole card. */
  readonly link = input.required<unknown[]>();
  /** Optional query params for the link (e.g. an issues filter). */
  readonly linkQuery = input<Record<string, unknown> | null>(null);
}
