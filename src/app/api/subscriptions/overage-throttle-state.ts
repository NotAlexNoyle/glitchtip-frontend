import type { components } from "../api-schema";

type OverageStatus = components["schemas"]["OverageStatusSchema"];

/**
 * Why an organization's events are being dropped, and whether the overage
 * controls can do anything about it.
 */
export type OverageThrottleState =
  /** Overage status has not loaded. */
  | "unknown"
  /** Not throttled: every event is being accepted. */
  | "none"
  /** Throttled with overage off but available. Turning it on creates headroom. */
  | "no-overage"
  /** Throttled with overage off and not available to this org at all. */
  | "unavailable"
  /** Throttled with overage live and a raisable cap reached. Raising it helps. */
  | "cap"
  /** Throttled with overage live but no raisable cap to blame. */
  | "throttled"
  /** Throttled with overage on, but the plan cannot be billed for it. */
  | "stalled-plan"
  /** Throttled with overage on and billable, but the server is not running it. */
  | "stalled-broken";

/**
 * Overage reads "on" but is granting no headroom. `active` is the predicate the
 * throttle task enforces, so this cannot drift from what the server does: it
 * covers an ineligible plan, a cleared primary subscription, and a metered item
 * that has gone from Stripe, which `enabled` alone hides in every case.
 */
export function isOverageInactive(status: OverageStatus | null): boolean {
  if (!status) return false;
  return status.enabled && !status.active;
}

/**
 * Whose problem an inactive overage is: an ineligible plan is a consequence of
 * the customer's own change, an eligible one means the metered item has gone
 * from Stripe, which they cannot fix and are not being billed for. Separate
 * from `overageThrottleState` because the cause is known before throttling
 * starts, and that only answers what remedy to offer an already-throttled org.
 */
export function overageInactiveCause(
  status: OverageStatus | null,
): "plan" | "broken" | null {
  if (!status || !isOverageInactive(status)) return null;
  return status.eligible ? "broken" : "plan";
}

/** Usage has consumed the spend cap. Only meaningful with overage enabled. */
export function capReached(status: OverageStatus | null): boolean {
  if (!status || !status.enabled) return false;
  return status.capUnits > 0 && status.overageUnits >= status.capUnits;
}

/**
 * Only `active` says overage is not working. Inferring it from usage sitting
 * below the cap reads across a lagging value, since `throttleRate` is written by
 * a background sweep while usage and the cap are computed per request, and told
 * customers their cap raise had failed right after it worked. The cap is blamed
 * only once usage has actually reached it (see `throttled`).
 */
export function overageThrottleState(
  status: OverageStatus | null,
): OverageThrottleState {
  if (!status) return "unknown";
  if (!status.throttleRate) return "none";
  // Both conditions are what the enable endpoint itself checks, so offering the
  // toggle without them is a dead end.
  if (!status.enabled) {
    return status.eligible && status.configured ? "no-overage" : "unavailable";
  }
  // Both mean "no headroom", but they get different remedies.
  const cause = overageInactiveCause(status);
  if (cause) return cause === "broken" ? "stalled-broken" : "stalled-plan";
  // "cap" is a remedy claim. With the overage price archived (configured
  // false) the cap endpoint rejects changes, so never point anyone at the cap.
  return capReached(status) && status.configured ? "cap" : "throttled";
}
