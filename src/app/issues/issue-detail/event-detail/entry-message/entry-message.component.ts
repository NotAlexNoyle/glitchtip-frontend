import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
} from "@angular/core";
import { IssueDetailService } from "../../issue-detail.service";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { formatValue } from "../event-format";

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

  private params = computed(() => {
    const params = this.eventEntryMessage()?.params;
    if (!params) return [];
    return Array.isArray(params)
      ? params.map((p) => formatValue(p))
      : Object.entries(params).map(([k, v]) => `${k}=${formatValue(v)}`);
  });

  paramsText = computed(() => this.params().join(" · "));

  subtitle = computed(() => {
    const n = this.params().length;
    if (!n) return "";
    return n === 1 ? $localize`1 param` : $localize`${n} params`;
  });

  /** The template only adds something when it differs from the message. */
  template = computed(() => {
    const m = this.eventEntryMessage();
    return m?.message && m.message !== m.formatted ? m.message : null;
  });
}
