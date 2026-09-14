import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { DaysAgoPipe, DaysOldPipe } from "../days-ago.pipe";
import { LocalDatePipe } from "../date/local-date.pipe";

/**
 * gt-timestamp — the canonical representation of the *timestamp* attribute type:
 * a moment in time, shown as human-relative text ("6 days ago") with the exact
 * localised time on hover, in a semantic <time> element.
 *
 * OOUX (the "A" pillar, by attribute *type*): a timestamp is a timestamp
 * whether it sits on an Issue, a Comment, or a Monitor check — so it should read
 * and behave identically everywhere. Before this, the same moment was rendered
 * ~7 different ways (daysAgo / daysOld / date:'medium' / date:'short' / a
 * separate always-visible exact caption / …). This composes the existing pipes
 * into one representation so the type has a single home.
 *
 * NOTE: this is for a *moment*. "Up for 3 days" (how long a state has held) is a
 * different attribute type (state-duration) and deliberately not handled here.
 */
@Component({
  selector: "gt-timestamp",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DaysAgoPipe, DaysOldPipe, LocalDatePipe],
  template: `@if (value(); as v) {
    <time class="gt-timestamp" [attr.datetime]="v" [title]="v | gtLocalDate: 'MMM d, y, h:mm a'">{{
      mode() === "old" ? (v | daysOld) : (v | daysAgo)
    }}</time>
  }`,
})
export class TimestampComponent {
  /** ISO date-time string (or null/undefined → renders nothing). */
  readonly value = input.required<string | null | undefined>();
  /**
   * 'ago' (default) → "6 days ago" — when something last happened.
   * 'old' → "6 days old" — the age of something (e.g. first seen).
   */
  readonly mode = input<"ago" | "old">("ago");
}
