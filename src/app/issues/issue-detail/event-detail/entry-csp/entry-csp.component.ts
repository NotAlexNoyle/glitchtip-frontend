import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
} from "@angular/core";
import { IssueDetailService } from "../../issue-detail.service";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import {
  GhostSelectComponent,
  GhostSelectOption,
} from "src/app/shared/ghost-select/ghost-select.component";
import { Json } from "src/app/interface-primitives";
import { formatValue } from "../event-format";

const LABELS: { [key: string]: string } = {
  blocked_uri: $localize`Blocked URI`,
  document_uri: $localize`Document URI`,
  effective_directive: $localize`Effective directive`,
  violated_directive: $localize`Violated directive`,
  disposition: $localize`Disposition`,
  status_code: $localize`Status code`,
  source_file: $localize`Source file`,
  line_number: $localize`Line`,
  column_number: $localize`Column`,
  script_sample: $localize`Script sample`,
  referrer: $localize`Referrer`,
  original_policy: $localize`Original policy`,
};

@Component({
  selector: "gt-entry-csp",
  templateUrl: "./entry-csp.component.html",
  styleUrls: ["./entry-csp.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelComponent, GhostSelectComponent],
})
export class EntryCSPComponent {
  private issueService = inject(IssueDetailService);

  eventEntryCSP = this.issueService.eventEntryCSP;
  readonly formats: GhostSelectOption[] = [
    { value: "report", label: $localize`Report` },
    { value: "raw", label: $localize`Raw` },
  ];
  readonly format = signal("report");

  subtitle = computed(() =>
    String(this.eventEntryCSP()?.["effective_directive"] ?? ""),
  );

  /** Known fields first in a fixed order, then the rest; empty ones left out. */
  rows = computed(() => {
    const csp = this.eventEntryCSP();
    if (!csp) return [];
    const keys = [
      ...Object.keys(LABELS).filter((k) => k in csp),
      ...Object.keys(csp).filter((k) => !(k in LABELS)),
    ];
    return keys
      .filter((k) => csp[k] !== null && csp[k] !== undefined && csp[k] !== "")
      .map((k) => ({
        key: k,
        label: LABELS[k] ?? k,
        value: formatValue(csp[k] as Json),
        mono: k.endsWith("directive") || k === "original_policy",
      }));
  });

  /** The report as the browser sends it, under its "csp-report" key. */
  raw = computed(() =>
    JSON.stringify({ "csp-report": this.eventEntryCSP() ?? {} }, null, 2),
  );
}
