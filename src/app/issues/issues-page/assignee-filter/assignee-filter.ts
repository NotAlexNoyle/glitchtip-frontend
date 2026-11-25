import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from "@angular/core";
import { MatMenuModule } from "@angular/material/menu";
import { IssueActor } from "src/app/issues/interfaces";
import {
  AssigneeOptionsService,
  assigneeLabel,
} from "src/app/shared/assignee-picker/assignee-options.service";
import {
  AssigneePickerComponent,
  AssigneeShortcut,
} from "src/app/shared/assignee-picker/assignee-picker";
import { assignedValueFor } from "../../assignee-query";

/** The issue list's Assignee filter: a ghost dropdown over the shared assignee picker. */
@Component({
  selector: "gt-assignee-filter",
  imports: [MatMenuModule, AssigneePickerComponent],
  templateUrl: "./assignee-filter.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssigneeFilterComponent {
  private options = inject(AssigneeOptionsService);

  /** The assigned: value in the search, or null for anyone. */
  readonly value = input<string | null>(null);
  readonly changed = output<string | null>();

  readonly anyLabel = $localize`Any assignee`;
  readonly shortcuts: AssigneeShortcut[] = [
    { value: null, label: this.anyLabel },
    { value: "me", label: $localize`Assigned to me` },
    { value: "my_teams", label: $localize`My teams` },
    { value: "none", label: $localize`Unassigned` },
  ];

  readonly valueForActor = (actor: IssueActor) => assignedValueFor(actor);

  private readonly all = computed(() => [
    ...this.options.teams(),
    ...this.options.members(),
  ]);

  /** The person or team the filter names, for the picker's check. */
  readonly currentActor = computed(() => {
    const value = this.value();
    return (
      this.all().find((o) => this.valueForActor(o.actor) === value)?.actor ??
      null
    );
  });
  /** The shortcut the filter is on, if it is one. */
  readonly currentShortcut = computed(() => {
    const value = this.value();
    return this.shortcuts.some((s) => s.value === value) ? value : undefined;
  });

  /** The label for an assigned: value; empty for anyone. */
  readonly labelFor = (value: string | null): string => {
    const shortcut = this.shortcuts.find((s) => s.value === value);
    if (shortcut) return value === null ? "" : shortcut.label;
    const option = this.all().find(
      (o) => this.valueForActor(o.actor) === value,
    );
    return option ? assigneeLabel(option.actor) : (value ?? "");
  };

  readonly display = computed(() => this.labelFor(this.value()));
  // Names the control and repeats the value it shows, for voice control.
  readonly ariaLabel = computed(
    () => $localize`Assignee: ${this.display() || this.anyLabel}`,
  );

  select(value: string | null) {
    if (value !== this.value()) this.changed.emit(value);
  }
}
