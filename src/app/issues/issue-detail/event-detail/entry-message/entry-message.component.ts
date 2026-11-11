import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
} from "@angular/core";
import { IssueDetailService } from "../../issue-detail.service";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { formatValue, recordOf } from "../event-format";

@Component({
  selector: "gt-entry-message",
  templateUrl: "./entry-message.component.html",
  styleUrls: ["./entry-message.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelComponent],
})
export class EntryMessageComponent {
  private issueService = inject(IssueDetailService);

  eventEntryMessage = this.issueService.eventEntryMessage;

  /** The message, unless it only repeats the exception shown above it. */
  text = computed(() => {
    const m = this.eventEntryMessage();
    const text = m?.formatted || m?.message || "";
    // The stored message is cut short with "…", so a prefix counts too.
    const head = text.endsWith("…") ? text.slice(0, -1) : text;
    const repeats = this.issueService
      .exceptionChain()
      .some((v) =>
        [v.value ?? "", `${v.type}: ${v.value}`].some((full) =>
          head === text ? full === text : full.startsWith(head),
        ),
      );
    return repeats ? "" : text;
  });

  params = computed(() => {
    const params: unknown = this.eventEntryMessage()?.params;
    return Array.isArray(params)
      ? params.map((p) => formatValue(p))
      : Object.entries(recordOf(params)).map(
          ([k, v]) => `${k}=${formatValue(v)}`,
        );
  });

  paramsText = computed(() => this.params().join(" · "));

  /** The template only adds something when it differs from the message. */
  template = computed(() => {
    const m = this.eventEntryMessage();
    // Without a formatted text the message is the text itself, not a template.
    return m?.formatted && m.message && m.message !== m.formatted
      ? m.message
      : null;
  });

  /** A message entry with no text, template or params has nothing to show. */
  hasContent = computed(
    () => !!(this.text() || this.template() || this.paramsText()),
  );
}
