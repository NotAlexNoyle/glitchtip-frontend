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
  assigneeLabel,
  isCurrentAssignee,
} from "./assignee-options.service";

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
  private matches = (option: AssigneeOption) => {
    const q = this.query().trim().toLowerCase();
    if (!q) return true;
    const { name, email, slug } = option.actor;
    return [name, email, slug].some((s) => s?.toLowerCase().includes(q));
  };
  readonly members = computed(() =>
    this.options.members().filter((m) => !m.isMe && this.matches(m)),
  );
  readonly teams = computed(() => this.options.teams().filter(this.matches));
  readonly showMe = computed(() => {
    const me = this.me();
    return !!me && this.matches(me);
  });
  readonly noMatches = computed(
    () =>
      !this.loading() &&
      !this.showMe() &&
      !this.members().length &&
      !this.teams().length,
  );

  readonly label = assigneeLabel;

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
