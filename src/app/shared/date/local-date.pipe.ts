import { Pipe, PipeTransform } from "@angular/core";
import { formatDate } from "@angular/common";

/**
 * Formats a date and appends a short timezone label ONLY when the displayed
 * zone differs from the viewer's local zone. Timestamps shown in the viewer's
 * own timezone don't need a redundant "GMT-7" suffix; a server-computed time in
 * a different zone does.
 *
 * Usage: {{ value | gtLocalDate }}                  // local, no tz suffix
 *        {{ value | gtLocalDate: 'medium' }}
 *        {{ value | gtLocalDate: 'medium' : serverTz }} // suffix iff tz differs
 */
@Pipe({ name: "gtLocalDate", standalone: true })
export class LocalDatePipe implements PipeTransform {
  transform(
    value: string | number | Date | null | undefined,
    format = "medium",
    timeZone?: string,
  ): string {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return "";
    }
    const formatted = formatDate(date, format, "en-US", timeZone);
    const localLabel = this.shortTzLabel(date, undefined);
    const shownLabel = this.shortTzLabel(date, timeZone);
    // No suffix when displaying the viewer's own zone (or when they match).
    if (!timeZone || shownLabel === localLabel) {
      return formatted;
    }
    return shownLabel ? `${formatted} ${shownLabel}` : formatted;
  }

  private shortTzLabel(date: Date, timeZone?: string): string {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "short",
      }).formatToParts(date);
      return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      return "";
    }
  }
}
