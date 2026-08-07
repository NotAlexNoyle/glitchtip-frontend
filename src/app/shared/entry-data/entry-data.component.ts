import { Component, ChangeDetectionStrategy, input } from "@angular/core";

@Component({
  standalone: true,
  selector: "gt-entry-data",
  templateUrl: "./entry-data.component.html",
  styleUrls: ["./entry-data.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { "[class.dense]": "dense()" },
})
export class EntryDataComponent {
  readonly key = input<any>();
  readonly value = input<any>();
  // Dense variant for narrow contexts (e.g. the issue detail metadata rail):
  // caption label, plain value, no shaded mono box, tighter spacing.
  readonly dense = input(false);
  // Force the value into monospace (identifiers). Defaults to the raw-event-data
  // treatment (mono) in the standard variant and plain text in the dense variant;
  // pass explicitly to override (e.g. a short id in the dense rail).
  readonly mono = input<boolean | undefined>(undefined);

  get hasValue() {
    const value = this.value();
    return value !== undefined && value !== null;
  }
  get displayValue() {
    const value = this.value();
    return typeof value === "object" ? JSON.stringify(value) : value;
  }
  get isMono() {
    const m = this.mono();
    return m === undefined ? !this.dense() : m;
  }
}
