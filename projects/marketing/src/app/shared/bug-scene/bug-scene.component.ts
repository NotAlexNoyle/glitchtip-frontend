import { ChangeDetectionStrategy, Component } from "@angular/core";

/** A paper bug flatlines an uptime pulse; markup from scripts/bug-art/build.py. */
@Component({
  selector: "mkt-bug-scene",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./bug-scene.component.html",
  styleUrl: "./bug-scene.component.scss",
})
export class BugSceneComponent {}
