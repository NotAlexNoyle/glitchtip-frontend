import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatDividerModule } from "@angular/material/divider";
import {
  AssigneeOption,
  AssigneeOptionsService,
  assigneeLabel,
  assigneeList,
} from "src/app/shared/assignee-picker/assignee-options.service";
import { AssigneeOptionComponent } from "src/app/shared/assignee-picker/assignee-option";
import { assignedValueFor } from "../../assignee-query";

interface Shortcut {
  value: string | null;
  label: string;
}

/** The issue list's Assignee filter: a field you type into, like the assign picker. */
@Component({
  selector: "gt-assignee-filter",
  imports: [
    MatAutocompleteModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatDividerModule,
    AssigneeOptionComponent,
  ],
  templateUrl: "./assignee-filter.html",
  styleUrl: "./assignee-filter.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssigneeFilterComponent {
  private options = inject(AssigneeOptionsService);

  /** The assigned: value in the search, or null for anyone. */
  readonly value = input<string | null>(null);
  readonly changed = output<string | null>();

  readonly typed = signal<string | null>(null);

  readonly shortcuts: Shortcut[] = [
    { value: null, label: $localize`Anyone` },
    { value: "me", label: $localize`Assigned to me` },
    { value: "my_teams", label: $localize`My teams` },
    { value: "none", label: $localize`Unassigned` },
  ];

  readonly valueFor = (option: AssigneeOption) =>
    assignedValueFor(option.actor);

  readonly list = computed(() =>
    assigneeList(
      this.options.teams(),
      this.options.members(),
      this.typed() ?? "",
      (option) => this.isCurrent(option),
    ),
  );
  // Anyone always stays, so the panel never empties and closes while typing.
  readonly visibleShortcuts = computed(() => {
    const q = (this.typed() ?? "").trim().toLowerCase();
    return this.shortcuts.filter(
      (s) => s.value === null || !q || s.label.toLowerCase().includes(q),
    );
  });
  readonly groups = computed(() => [
    { label: $localize`Teams`, options: this.list().teams },
    { label: $localize`Members`, options: this.list().members },
  ]);
  readonly noMatches = computed(
    () =>
      !!(this.typed() ?? "").trim() &&
      !this.list().total &&
      this.visibleShortcuts().length === 1,
  );
  readonly moreNote = computed(() => {
    const { shown, total } = this.list();
    return shown < total
      ? $localize`Showing ${shown} of ${total}. Type to narrow.`
      : null;
  });

  /** The label for an assigned: value, which the field shows after a pick too. */
  readonly labelFor = (value: string | null): string => {
    const shortcut = this.shortcuts.find((s) => s.value === value);
    if (shortcut) return value === null ? "" : shortcut.label;
    const all = [...this.options.teams(), ...this.options.members()];
    const option = all.find((o) => this.valueFor(o) === value);
    return option ? assigneeLabel(option.actor) : (value ?? "");
  };

  /** What the field shows when you aren't typing. */
  readonly display = computed(() => this.labelFor(this.value()));
  readonly text = computed(() => this.typed() ?? this.display());

  isCurrent(option: AssigneeOption) {
    return this.valueFor(option) === this.value();
  }

  select(value: string | null) {
    this.typed.set(null);
    if (value !== this.value()) this.changed.emit(value);
  }

  /** Closing without a choice puts the current filter's name back. */
  reset() {
    this.typed.set(null);
  }
}
