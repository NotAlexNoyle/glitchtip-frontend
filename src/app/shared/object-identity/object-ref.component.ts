import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatIconModule } from "@angular/material/icon";
import { OBJECT_ICON, ObjectType } from "./object-identity";

/**
 * gt-object-ref — a nested reference: one object mentioned inside another
 * object's page (a Release on an Issue, a Member as an assignee, a Project on a
 * Member…). It wears the referenced object's icon and, when a link is given,
 * becomes navigable — turning a dead-end mention into a real relationship.
 *
 * OOUX: an object should look the same and be reachable wherever it appears.
 * This primitive is that promise, made once.
 */
@Component({
  selector: "gt-object-ref",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatIconModule],
  templateUrl: "./object-ref.component.html",
  styleUrl: "./object-ref.component.scss",
})
export class ObjectRefComponent {
  /** Which object this refers to — drives the glyph. */
  readonly type = input.required<ObjectType>();
  /** Primary label — the object's name or identifier. */
  readonly label = input.required<string>();
  /** Accent colour (e.g. an issue level token); tints the glyph. */
  readonly accent = input<string | null>(null);
  /** RouterLink target; when present, the reference is navigable. */
  readonly link = input<unknown[] | null>(null);
  /** Render the label in the mono identifier face (versions, ids, emails). */
  readonly mono = input(false);
  /** Override the glyph; defaults to the object type's icon. */
  readonly icon = input<string | null>(null);

  protected readonly glyph = computed(
    () => this.icon() ?? OBJECT_ICON[this.type()],
  );
}
