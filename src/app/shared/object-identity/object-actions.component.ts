import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { ObjectActionItem } from "./object-actions";

/**
 * gt-object-actions — one affordance for an object's CTAs, rendered the same way
 * wherever the object appears. The likely-next action is a button; the rest live
 * in an overflow menu, in the catalog's order. It is presentational: it emits
 * the chosen action id and the host runs the matching handler.
 *
 * Completes the object triad — recognizable (identity), reachable (object-ref),
 * actionable (this).
 */
@Component({
  selector: "gt-object-actions",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: "./object-actions.component.html",
  styleUrl: "./object-actions.component.scss",
})
export class ObjectActionsComponent {
  /** The likely-next action, shown as a button. */
  readonly primary = input<ObjectActionItem | null>(null);
  /** The remaining actions, shown in the overflow menu. */
  readonly more = input<ObjectActionItem[]>([]);
  /** Emits the chosen action's id; the host wires it to the real handler. */
  readonly action = output<string>();
}
