import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import { LoadingButtonComponent } from "src/app/shared/loading-button/loading-button.component";
import { ApiRow, PreviewDocComponent } from "../docs/preview-doc.component";

/**
 * Documents the app's permission-gating convention (see CLAUDE.md): gate by
 * reason. Permission gates hide; transient state disables with a reason.
 */
@Component({
  selector: "preview-permission-gating",
  imports: [
    MatButtonModule,
    MatCardModule,
    MatSlideToggleModule,
    LoadingButtonComponent,
    PreviewDocComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .pg-toggle-row {
        display: flex;
        align-items: center;
        gap: var(--gt-space-4);
        margin-bottom: var(--gt-space-4);
      }
      .pg-card {
        max-width: 420px;
      }
      .pg-card mat-card-content {
        display: flex;
        flex-direction: column;
        gap: var(--gt-space-3);
      }
      .pg-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--gt-space-4);
      }
      .pg-note {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
  template: `
    <preview-doc
      title="Permission gating"
      status="stable"
      description="How write and delete controls are gated, by reason. Role or permission gates hide the control entirely with @if on the relevant access signal. Transient state (pristine form, request in flight, missing prerequisite) disables it, with the reason visible. Never [disabled] for permission."
      [whenToUse]="whenToUse"
      [dos]="dos"
      [donts]="donts"
      a11y="Hiding keeps unusable controls out of screen-reader and tab order entirely; a permanently disabled button would still be discovered and announced, promising something the user can never do. Disabled is reserved for states the user can change."
      [api]="api"
      [code]="code"
    >
      <div class="preview-section">
        <div class="preview-section__title">Live example</div>
        <p class="preview-section__note">
          Flip the simulated role. With write access the delete action exists
          and the save button disables only while a request is in flight. As a
          read-only member the write controls are gone, not grayed out.
        </p>
        <div class="pg-toggle-row">
          <mat-slide-toggle
            [checked]="canWrite()"
            (change)="canWrite.set($event.checked)"
          >
            Simulate canWriteProject()
          </mat-slide-toggle>
        </div>
        <mat-card appearance="outlined" class="pg-card">
          <mat-card-content>
            <div class="pg-row">
              <span>Environment: production</span>
              @if (canWrite()) {
                <button mat-stroked-button (click)="fakeSave()">Hide</button>
              }
            </div>
            <div class="pg-row">
              <span>Project settings</span>
              @if (canWrite()) {
                <gt-loading-button
                  buttonText="Save"
                  [loading]="saving()"
                  (buttonClick)="fakeSave()"
                />
              } @else {
                <span class="pg-note">Read-only member</span>
              }
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </preview-doc>
  `,
})
export class PermissionGatingPreview {
  readonly canWrite = signal(true);
  readonly saving = signal(false);

  readonly whenToUse = [
    "Every write or delete control in org, team, and project settings",
    "Bulk actions on lists (resolve, delete, merge)",
  ];
  readonly dos = [
    "Gate with @if on a named capability gate from OrganizationsService (canWriteProject, canAdminOrg, ...)",
    "Add a new named gate rather than writing a scope list at the call site",
    "For team member changes use TeamsService.canModifyTeam — the rule depends on whether you are in the team",
    "Hide the whole card if hiding a lone action would leave it empty",
    "Use [disabled] only for transient state, with the reason evident (spinner, pristine form)",
    "Re-home copy that points at a control you just hid — it dangles otherwise",
    "Check whether a hidden control was also displaying a value; if so, leave a read-only readout",
    "Drop imports the removed control leaves orphaned (MatTooltipModule and friends)",
  ];
  readonly donts = [
    "Disable a control the user will never be allowed to use",
    "Rely on gating for security instead of the backend",
    "Call hasScope(...) inline in a template — the ()() form makes !hasScope('x') silently always false",
  ];
  readonly api: ApiRow[] = [
    {
      name: "canWriteProject()",
      type: "Signal<boolean>",
      default: "",
      description:
        "project:write | project:admin — new/rename project, alerts, add or remove a project from a team",
    },
    {
      name: "canAdminProject()",
      type: "Signal<boolean>",
      default: "",
      description: "project:admin — delete a project or an alert",
    },
    {
      name: "canWriteTeam() / canAdminTeam()",
      type: "Signal<boolean>",
      default: "",
      description: "team:write|admin — rename a team; team:admin — delete one",
    },
    {
      name: "canWriteOrg() / canAdminOrg()",
      type: "Signal<boolean>",
      default: "",
      description:
        "org:write|admin — rename the org; org:admin (Owner only) — delete it, transfer ownership, billing",
    },
    {
      name: "canWriteMember() / canAdminMember()",
      type: "Signal<boolean>",
      default: "",
      description:
        "member:write|admin — invite, resend, change role; member:admin — remove a member",
    },
    {
      name: "canManageAnyTeam()",
      type: "Signal<boolean>",
      default: "",
      description:
        "Composite: canWriteTeam() || canWriteOrg() — create, rename or delete any team",
    },
    {
      name: "TeamsService.canModifyTeam()",
      type: "Signal<boolean>",
      default: "",
      description:
        "Team member changes: team managers if you are in the team, org managers if not. Only valid where teamMembersKey is set for the team on screen",
    },
    {
      name: "hasScope(...scopes)",
      type: "(...scopes: Scope[]) => Signal<boolean>",
      default: "",
      description:
        "The any-of primitive behind the gates above, memoized per combination. Public for ad-hoc use; prefer a named gate",
    },
  ];
  readonly code = `@if (canAdminProject()) {
  <button mat-stroked-button color="warn" (click)="delete()">
    Delete project
  </button>
}

<!-- transient state disables; permission never does -->
<gt-loading-button buttonText="Save" [loading]="saving()" />`;

  fakeSave(): void {
    if (this.saving()) return;
    this.saving.set(true);
    setTimeout(() => this.saving.set(false), 900);
  }
}
