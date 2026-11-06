import { ChangeDetectionStrategy, Component } from "@angular/core";

// Stop-motion frame rate, shared with the paper bear and bug.
const FPS = 8;

// x = W is the hairline; FEED matches --flow-feed in home.component.scss.
const W = 900;
const FEED = 96;
const PORT = 300;
// The gap between the copy and the hairline that routes drop down.
const GAP = W - 20;
// How far routes overshoot the edges they cross, hidden by the host's clip,
// so cubes slide in from under the top line and into the window.
const OVER = 24;

// The product's issue levels, so cubes read like the issue list's stripes.
type Level = "error" | "warning" | "info";

interface Route {
  d: string;
  // Seconds per trip.
  dur: number;
  // Cubes on this route, staggered so they never move in step.
  trips: { level: Level; delay: number }[];
}

/** Hero decoration: level-colored events ride routes into the product window. */
@Component({
  selector: "mkt-event-flow",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "aria-hidden": "true" },
  templateUrl: "./event-flow.component.html",
  styleUrl: "./event-flow.component.scss",
})
export class EventFlowComponent {
  protected readonly size = { w: W + FEED, h: PORT + 40 };

  // Both routes share the drop down the gap and the feed line into the window.
  private readonly feed = `V${PORT - 12} q0 12 12 12 H${W + FEED + OVER}`;

  // Both drop from the hero's top hairline, so no line starts in empty space.
  protected readonly routes = withSteps([
    {
      d: `M${W - 440} -${OVER} V36 q0 12 12 12 H${GAP - 12} q12 0 12 12 ${this.feed}`,
      dur: 5.4,
      trips: [
        { level: "error", delay: 0 },
        { level: "warning", delay: 2.7 },
      ],
    },
    {
      d: `M${W - 200} -${OVER} V100 q0 12 12 12 H${GAP - 12} q12 0 12 12 ${this.feed}`,
      dur: 4.4,
      trips: [
        { level: "info", delay: 1.2 },
        { level: "error", delay: 3.4 },
      ],
    },
  ]);

  // Where the routes cross and meet, and the port on the hairline.
  protected readonly nodes: [number, number][] = [
    [W - 200, 48],
    [GAP, 112],
    [W, PORT],
  ];
}

function withSteps(routes: Route[]) {
  return routes.map((r) => ({ ...r, steps: Math.round(r.dur * FPS) }));
}
