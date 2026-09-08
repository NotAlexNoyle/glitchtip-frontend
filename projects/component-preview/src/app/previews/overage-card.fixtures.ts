import type { components } from "src/app/api/api-schema";

type OverageStatus = components["schemas"]["OverageStatusSchema"];

/**
 * Every overage card state an organization can actually land in, and the
 * account change that puts it there.
 *
 * Numbers mirror `./manage.py overage_state <slug> <state>` on a local
 * backend — quota 1000, $1 cap (capUnits 5882) — so a card here and a card on
 * a seeded dev instance are comparable side by side.
 */
const base: OverageStatus = {
  enabled: true,
  eligible: true,
  configured: true,
  active: true,
  capCents: 100,
  maxCapCents: 1_000_000,
  capUnits: 5882,
  quota: 1000,
  usage: 500,
  overageUnits: 0,
  overageCostCents: 0,
  throttleRate: 0,
};

/** Usage well past quota, with the sweep having caught up and clamped ingest. */
const throttled = { usage: 9000, overageUnits: 8000, throttleRate: 100 };

export interface Fixture {
  /** Short name for the state, used as the heading. */
  label: string;
  /** `overageThrottleState()` this fixture should produce. */
  expect: string;
  /** What the customer did, or what happened to them, to arrive here. */
  cause: string;
  status: OverageStatus;
  /** Forces the end-of-cycle forecast, which usage alone cannot express. */
  willReachCap?: boolean;
}

export interface FixtureGroup {
  title: string;
  blurb: string;
  fixtures: Fixture[];
}

export const FIXTURE_GROUPS: FixtureGroup[] = [
  {
    title: "Overage on and working",
    blurb:
      "The server is metering usage above quota and billing for it. Nothing " +
      "is being dropped, so the card is informational: spend so far, progress " +
      "against the cap, and a control to raise it.",
    fixtures: [
      {
        label: "Inside quota",
        expect: "none",
        cause:
          "Overage is switched on but usage has not passed the plan quota, so " +
          "nothing has been metered yet. This is the state most orgs sit in " +
          "for most of the cycle.",
        status: { ...base },
      },
      {
        label: "Forecast to reach the cap",
        expect: "none",
        cause:
          "Usage is over quota and the current run rate projects it hitting " +
          "the cap before the cycle ends. Nothing is wrong yet, so this is an " +
          "advisory: raise the cap now or expect throttling later.",
        status: { ...base, usage: 4000, overageUnits: 3000, overageCostCents: 51 },
        willReachCap: true,
      },
      {
        label: "Cap reached, rate not yet swept",
        expect: "none",
        cause:
          "Usage has just crossed the cap. `throttleRate` is written by a " +
          "background sweep while usage and the cap are computed per request, " +
          "so for a few minutes the card knows the cap is gone before it knows " +
          "the rate. It warns from usage rather than waiting for the sweep.",
        status: { ...base, usage: 9000, overageUnits: 8000, overageCostCents: 100 },
      },
    ],
  },
  {
    title: "Throttled with overage on",
    blurb:
      "Events are being dropped despite overage being live. The remedy differs " +
      "per state, and the card only offers the cap control where changing it " +
      "would actually restore ingestion.",
    fixtures: [
      {
        label: "Spend cap reached",
        expect: "cap",
        cause:
          "Usage consumed the whole spend cap, so metering stopped and the " +
          "progressive throttle resumed — exactly what the cap is for. Raising " +
          "the cap is a real remedy here, so the card says so.",
        status: { ...base, ...throttled, overageCostCents: 100 },
      },
      {
        label: "Cap raised, rate lagging",
        expect: "throttled",
        cause:
          "The customer just raised the cap (here to $10). Usage now sits " +
          "below it, but the sweep has not recomputed the rate, so the card " +
          "would otherwise show headroom next to a total-loss figure. It says " +
          "which number is catching up instead of blaming the cap.",
        status: {
          ...base,
          ...throttled,
          capCents: 1000,
          capUnits: 58823,
          overageCostCents: 136,
        },
      },
      {
        label: "Overage price archived",
        expect: "throttled",
        cause:
          "At the cap, but the overage price was archived in Stripe, so the " +
          "cap endpoint would reject a change. Pointing at the cap would be a " +
          "dead end, so the card withholds that remedy and the cap editor.",
        status: { ...base, ...throttled, configured: false, overageCostCents: 100 },
      },
    ],
  },
  {
    title: "Overage on but granting nothing",
    blurb:
      "The toggle reads on and the server is not metering. Two causes, and " +
      "they are not the customer's to sort out equally: one they can fix by " +
      "changing plan, the other only support can. Each appears twice because " +
      "the cause is knowable before throttling starts, and the card names it " +
      "either way.",
    fixtures: [
      {
        label: "Plan not billable, inside quota",
        expect: "none",
        cause:
          "The customer moved to a plan that cannot carry metered billing — a " +
          "free, comped, or unlimited plan — while overage was still on. " +
          "Nothing is dropping yet because they are inside quota, but the " +
          "opt-in is inert and the card says so up front.",
        status: { ...base, eligible: false, active: false },
      },
      {
        label: "Plan not billable, throttled",
        expect: "stalled-plan",
        cause:
          "The same ineligible plan, now over quota. Overage adds no headroom, " +
          "so events are dropping and raising the cap cannot change that. " +
          "Upgrading is the remedy.",
        status: { ...base, ...throttled, eligible: false, active: false },
      },
      {
        label: "Metered item gone, inside quota",
        expect: "none",
        cause:
          "The plan is perfectly billable, but the metered item has gone from " +
          "the subscription in Stripe — most often because the subscription " +
          "that carried it was replaced. Not the customer's doing and not " +
          "billable to them, so the card points at support rather than at " +
          "their plan.",
        status: { ...base, active: false },
      },
      {
        label: "Metered item gone, throttled",
        expect: "stalled-broken",
        cause:
          "The same missing item, now over quota. Events are dropping, the " +
          "customer is not being charged for the overage they are not getting, " +
          "and neither the toggle nor the cap can fix it.",
        status: { ...base, ...throttled, active: false },
      },
    ],
  },
  {
    title: "Overage off",
    blurb:
      "The plan quota is the hard ceiling. Whether the card appears at all " +
      "depends on the org being able to turn overage on.",
    fixtures: [
      {
        label: "Available, not switched on",
        expect: "no-overage",
        cause:
          "A paid plan over its quota with overage never enabled. Turning it " +
          "on is the remedy, so the card offers the toggle — and tells a " +
          "non-owner to ask an owner instead. Flip the owner control above to " +
          "see that wording.",
        status: { ...base, ...throttled, enabled: false, active: false },
      },
      {
        label: "Unavailable",
        expect: "unavailable",
        cause:
          "Over quota with overage off and unavailable — no overage product is " +
          "live, or the plan cannot carry one. The subscription page hides the " +
          "card entirely rather than showing a control that cannot be used; " +
          "the over-limit snackbar is the only surface. Shown here as the gate.",
        status: {
          ...base,
          ...throttled,
          enabled: false,
          configured: false,
          active: false,
        },
      },
    ],
  },
];

/** Flat list, for tests and for the state-coverage check. */
export const FIXTURES: Fixture[] = FIXTURE_GROUPS.flatMap((g) => g.fixtures);
