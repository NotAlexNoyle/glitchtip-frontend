import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { AssigneeOption, assigneeLabel } from "./assignee-options.service";

/** One assignee row's text: the name, then the email muted, on one line. */
@Component({
  selector: "gt-assignee-option",
  template: `<span class="name">{{ label(option().actor) }}</span>
    @if (option().actor.email && option().actor.email !== option().actor.name) {
      <span class="detail">{{ option().actor.email }}</span>
    }`,
  styles: `
    :host {
      display: flex;
      flex: 1;
      align-items: baseline;
      gap: var(--gt-space-2, 8px);
      min-width: 0;
      font: var(--mat-sys-label-large);
    }
    .name,
    .detail {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .name {
      flex: none;
      max-width: 100%;
    }
    .detail {
      flex: 1;
      min-width: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssigneeOptionComponent {
  readonly option = input.required<AssigneeOption>();
  readonly label = assigneeLabel;
}
