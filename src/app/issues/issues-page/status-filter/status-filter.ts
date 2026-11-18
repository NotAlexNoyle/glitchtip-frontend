import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from "@angular/core";
import { MatSelectModule } from "@angular/material/select";
import { SelectGhostDirective } from "src/app/shared/select-ghost.directive";
import { IssueStatus } from "../../interfaces";
import { ISSUE_STATUS } from "../../issue-status";

/** Stands for "no is: term" in the select, which can't hold null as a value. */
const ALL = "all";

/** The issue list's Status filter: the is: term in the search, as a ghost select. */
@Component({
  selector: "gt-status-filter",
  imports: [MatSelectModule, SelectGhostDirective],
  template: `
    <span gtSelectGhost>
      <mat-select
        i18n-aria-label
        aria-label="Status"
        hideSingleSelectionIndicator
        [panelWidth]="null"
        [value]="value() ?? all"
        (selectionChange)="pick($event.value)"
      >
        <mat-select-trigger>
          <span class="gt-select-ghost__value">{{ labelFor(value()) }}</span>
        </mat-select-trigger>
        @for (status of statuses; track status) {
          <mat-option [value]="status">{{ labels[status].label }}</mat-option>
        }
        <mat-option [value]="all">{{ allLabel }}</mat-option>
      </mat-select>
    </span>
  `,
  styles: `
    @use "filter-bar";

    :host {
      @include filter-bar.cell;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusFilterComponent {
  /** The is: value in the search, or null for every status. */
  readonly value = input<string | null>(null);
  readonly changed = output<string | null>();

  readonly all = ALL;
  readonly allLabel = $localize`All statuses`;
  readonly statuses: IssueStatus[] = ["unresolved", "resolved", "ignored"];
  readonly labels = ISSUE_STATUS;

  labelFor(value: string | null): string {
    if (!value) return this.allLabel;
    return ISSUE_STATUS[value as IssueStatus]?.label ?? value;
  }

  pick(value: string) {
    const next = value === ALL ? null : value;
    if (next !== this.value()) this.changed.emit(next);
  }
}
