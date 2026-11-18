import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from "@angular/core";
import { MatMenu, MatMenuModule } from "@angular/material/menu";
import { MatIconModule } from "@angular/material/icon";
import { MatDividerModule } from "@angular/material/divider";
import { IssueActor } from "src/app/issues/interfaces";
import {
  AssigneeOption,
  AssigneeOptionsService,
  assigneeList,
  isCurrentAssignee,
  matchesAssignee,
} from "./assignee-options.service";
import { AssigneeOptionComponent } from "./assignee-option";

/** What the picker emits: the assignedTo value and the actor to show, or null to unassign. */
export interface AssigneeChoice {
  value: string | null;
  actor: IssueActor | null;
}

/** A fixed row above the lists, in place of "Assign to me" (the list filter's Any assignee, My teams). */
export interface AssigneeShortcut {
  value: string | null;
  label: string;
}

/** The menu focuses its panel once open; take focus back for typing. */
@Directive({ selector: "input[gtFocusOnOpen]" })
export class FocusOnOpenDirective {
  constructor() {
    const el = inject<ElementRef<HTMLInputElement>>(ElementRef);
    afterNextRender(() => setTimeout(() => el.nativeElement.focus()));
  }
}

/** Assignee menu; open it with `[matMenuTriggerFor]="picker.menu()"`. */
@Component({
  selector: "gt-assignee-picker",
  exportAs: "gtAssigneePicker",
  imports: [
    MatMenuModule,
    MatIconModule,
    MatDividerModule,
    FocusOnOpenDirective,
    AssigneeOptionComponent,
  ],
  templateUrl: "./assignee-picker.html",
  styleUrl: "./assignee-picker.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssigneePickerComponent {
  private options = inject(AssigneeOptionsService);

  /** The issue's current assignee; checked in the list. Null when several issues are selected. */
  readonly current = input<IssueActor | null | undefined>(null);
  /** Hide "Unassign" when there is nothing to clear. */
  readonly showUnassign = input(true);
  /** Which way the menu extends from its trigger. */
  readonly xPosition = input<"before" | "after">("before");
  readonly picked = output<AssigneeChoice>();
  /** Rows above the lists instead of "Assign to me"; picking one emits shortcutPicked. */
  readonly shortcuts = input<AssigneeShortcut[]>([]);
  /** The shortcut to check, when the current value is one. */
  readonly currentShortcut = input<string | null | undefined>(undefined);
  readonly shortcutPicked = output<string | null>();

  readonly menu = viewChild.required(MatMenu);

  readonly query = signal("");
  readonly loading = this.options.loading;
  readonly me = this.options.me;
  readonly list = computed(() =>
    assigneeList(
      this.options.teams(),
      this.options.members().filter((m) => !m.isMe),
      this.query(),
      (option) => this.isCurrent(option),
    ),
  );
  readonly groups = computed(() => [
    { label: $localize`Teams`, options: this.list().teams },
    { label: $localize`Members`, options: this.list().members },
  ]);
  readonly visibleShortcuts = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.shortcuts().filter(
      (s) => !q || s.label.toLowerCase().includes(q),
    );
  });
  readonly showMe = computed(() => {
    const me = this.me();
    return (
      !this.shortcuts().length && !!me && matchesAssignee(me, this.query())
    );
  });
  readonly noMatches = computed(
    () =>
      !this.loading() &&
      !this.showMe() &&
      !this.visibleShortcuts().length &&
      !this.list().total,
  );
  readonly moreNote = computed(() => {
    const { shown, total } = this.list();
    return shown < total
      ? $localize`Showing ${shown} of ${total}. Type to narrow.`
      : null;
  });

  isCurrent(option: AssigneeOption) {
    return isCurrentAssignee(option, this.current());
  }

  pick(option: AssigneeOption | null) {
    this.picked.emit(
      option
        ? { value: option.value, actor: option.actor }
        : { value: null, actor: null },
    );
  }

  onMenuClosed() {
    this.query.set("");
  }

  /** Keep typing out of the menu's type-ahead; Enter picks the first match. */
  onFilterKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "ArrowDown") return;
    event.stopPropagation();
    if (event.key === "Enter") {
      // Otherwise the same Enter re-clicks the trigger once focus returns to it.
      event.preventDefault();
      // Only option rows, so an Enter before the list loads can't hit Unassign.
      (event.target as HTMLElement)
        .closest(".mat-mdc-menu-panel")
        ?.querySelector<HTMLElement>(".scroll [mat-menu-item]")
        ?.click();
    }
  }
}
