import { describe, it, expect } from "vitest";
import {
  overageInactiveCause,
  overageThrottleState,
} from "./overage-throttle-state";
import { FIXTURES } from "../../../../projects/component-preview/src/app/previews/overage-card.fixtures";

/**
 * Keeps the preview gallery honest: every fixture's claimed state has to be the
 * one the shipped function actually returns, so the page cannot drift into
 * documenting behaviour the app does not have.
 *
 * Lives under `src/` rather than beside the fixtures because `tsconfig.spec.json`
 * only includes `src/**\/*.spec.ts`.
 */
describe("overage card preview fixtures", () => {
  it("each fixture resolves to the state it claims", () => {
    expect(
      FIXTURES.map((f) => `${f.label} -> ${overageThrottleState(f.status)}`),
    ).toEqual(FIXTURES.map((f) => `${f.label} -> ${f.expect}`));
  });

  it("covers every state the card can render", () => {
    const covered = new Set(FIXTURES.map((f) => f.expect));
    expect([...covered].sort()).toEqual([
      "cap",
      "no-overage",
      "none",
      "stalled-broken",
      "stalled-plan",
      "throttled",
      "unavailable",
    ]);
  });

  // The tagline is driven by the cause, not the state, so state coverage alone
  // would leave the pre-throttle wording undocumented.
  it("shows both inactive causes on each side of the throttle sweep", () => {
    const seen = FIXTURES.filter((f) => overageInactiveCause(f.status)).map(
      (f) => `${overageInactiveCause(f.status)}:${f.status.throttleRate > 0}`,
    );
    expect([...new Set(seen)].sort()).toEqual([
      "broken:false",
      "broken:true",
      "plan:false",
      "plan:true",
    ]);
  });
});
