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
  readonly showMe = computed(() => {
    const me = this.me();
    return !!me && matchesAssignee(me, this.query());
  });
  readonly noMatches = computed(
    () => !this.loading() && !this.showMe() && !this.list().total,
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
