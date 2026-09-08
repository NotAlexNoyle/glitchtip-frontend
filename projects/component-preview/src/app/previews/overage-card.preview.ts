import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { MatSlideToggleModule } from "@angular/material/slide-toggle";
import type { components } from "src/app/api/api-schema";
import { OrganizationsService } from "src/app/api/organizations.service";
import { SubscriptionService } from "src/app/api/subscriptions/subscription.service";
import {
  capReached as capReachedFn,
  isOverageInactive,
  overageInactiveCause,
  overageThrottleState,
} from "src/app/api/subscriptions/overage-throttle-state";
import { OverageCardComponent } from "src/app/settings/subscription/overage-card/overage-card.component";
import { PreviewDocComponent } from "../docs/preview-doc.component";
import { FIXTURE_GROUPS, type Fixture } from "./overage-card.fixtures";

type OverageStatus = components["schemas"]["OverageStatusSchema"];

/**
 * Stands in for SubscriptionService. Every derived value comes from the real
 * functions the app ships, so this gallery cannot drift from the card's actual
 * behaviour — only the data source is faked, never the logic.
 */
class FakeSubscriptionService {
  readonly overageStatus = signal<OverageStatus | null>(null);
  /** End-of-cycle forecast, which usage alone cannot express. */
  readonly forceWillReachCap = signal(false);

  readonly overageEnabled = computed(
    () => this.overageStatus()?.enabled ?? false,
  );
  readonly throttleRate = computed(
    () => this.overageStatus()?.throttleRate ?? 0,
  );
  readonly overageInactive = computed(() =>
    isOverageInactive(this.overageStatus()),
  );
  readonly inactiveCause = computed(() =>
    overageInactiveCause(this.overageStatus()),
  );
  readonly throttleState = computed(() =>
    overageThrottleState(this.overageStatus()),
  );
  readonly capReached = computed(() => capReachedFn(this.overageStatus()));
  readonly canConfigureOverage = computed(() => {
    const s = this.overageStatus();
    return !!s?.eligible && !!s?.configured;
  });
  readonly capProgressPercent = computed(() => {
    const s = this.overageStatus();
    if (!s || !s.capUnits) return 0;
    return Math.min(100, Math.round((s.overageUnits / s.capUnits) * 100));
  });
  readonly maxCapCents = computed(
    () => this.overageStatus()?.maxCapCents ?? 1_000_000,
  );
  readonly willReachCap = this.forceWillReachCap;
  readonly overageConfigLoading = signal(false);
  readonly overageConfigError = signal("");
  readonly subscription = signal({
    subscriptionCycleEnd: new Date(Date.now() + 15 * 864e5).toISOString(),
    currentPeriodEnd: null,
  });

  /** Applies the change locally so the toggle and cap editor stay usable. */
  async configureOverage(enabled: boolean, capCents: number) {
    const s = this.overageStatus();
    if (!s) return null;
    const next = {
      ...s,
      enabled,
      capCents: enabled ? capCents : s.capCents,
      active: enabled && s.eligible,
    };
    this.overageStatus.set(next);
    return next;
  }
}

class FakeOrganizationsService {
  readonly accessOrgAdmin = signal(true);
}

/** One card in its own injector, so each state gets its own fake service. */
@Component({
  selector: "preview-overage-state",
  imports: [OverageCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    FakeSubscriptionService,
    FakeOrganizationsService,
    { provide: SubscriptionService, useExisting: FakeSubscriptionService },
    { provide: OrganizationsService, useExisting: FakeOrganizationsService },
  ],
  styles: [
    `
      :host {
        display: block;
      }
      .oc-head {
        display: flex;
        align-items: baseline;
        gap: var(--gt-space-3);
        flex-wrap: wrap;
        margin-bottom: var(--gt-space-2);
      }
      .oc-label {
        font: var(--mat-sys-title-small);
      }
      .oc-state {
        font-family: monospace;
        font-size: 0.85em;
        padding: 0 var(--gt-space-2);
        border-radius: 4px;
        background: var(--mat-sys-surface-container-high);
        color: var(--mat-sys-on-surface-variant);
      }
      .oc-cause {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
        margin: 0 0 var(--gt-space-3);
        max-width: 62ch;
      }
      .oc-hidden {
        padding: var(--gt-space-4);
        border: 1px dashed var(--mat-sys-outline);
        border-radius: 8px;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
  template: `
    <div class="oc-head">
      <span class="oc-label">{{ fixture().label }}</span>
      <span class="oc-state">{{ actualState() }}</span>
    </div>
    <p class="oc-cause">{{ fixture().cause }}</p>
    @if (showCard()) {
      <gt-overage-card />
    } @else {
      <div class="oc-hidden">
        Card not rendered — the subscription page's gate is false here, so the
        over-limit snackbar is the only surface for this state.
      </div>
    }
  `,
})
export class OverageStatePreview {
  readonly fixture = input.required<Fixture>();
  readonly owner = input(true);

  private fake = inject(FakeSubscriptionService);
  private fakeOrg = inject(FakeOrganizationsService);

  /** Computed by the shipped predicate, not read off the fixture. */
  readonly actualState = this.fake.throttleState;
  /** Mirrors SubscriptionComponent's showOverageCard. */
  readonly showCard = computed(
    () => this.fake.canConfigureOverage() || this.fake.overageEnabled(),
  );

  constructor() {
    effect(() => {
      const f = this.fixture();
      this.fake.overageStatus.set({ ...f.status });
      this.fake.forceWillReachCap.set(f.willReachCap ?? false);
    });
    effect(() => this.fakeOrg.accessOrgAdmin.set(this.owner()));
  }
}

/**
 * Visual inventory of the overage card, one entry per state an organization
 * can reach and the account change that gets it there.
 */
@Component({
  selector: "preview-overage-card",
  imports: [MatSlideToggleModule, PreviewDocComponent, OverageStatePreview],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .oc-controls {
        display: flex;
        align-items: center;
        gap: var(--gt-space-4);
        margin-bottom: var(--gt-space-5);
      }
      .oc-blurb {
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
        margin: 0 0 var(--gt-space-5);
        max-width: 70ch;
      }
      .oc-grid {
        display: grid;
        gap: var(--gt-space-6);
      }
      .oc-grid--split {
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      }
    `,
  ],
  template: `
    <preview-doc
      title="Overage card states"
      description="Every state the subscription page's overage card can reach, rendered from the real component against fixtures matching ./manage.py overage_state. The monospace label under each heading is computed by the shipped overageThrottleState(), never hardcoded, so a card that renders the wrong copy for its state shows up here as a mismatch."
      [dos]="dos"
      [donts]="donts"
      a11y="Each alert is a plain paragraph in reading order rather than a live region: the card is a page section the user navigates to, not an interruption. The cap editor is hidden rather than disabled where the server would reject the change, so no one tabs into a dead control."
    >
      <div class="preview-section">
        <div class="preview-section__title">Controls</div>
        <div class="oc-controls">
          <mat-slide-toggle
            [checked]="owner()"
            (change)="owner.set($event.checked)"
          >
            Organization owner
          </mat-slide-toggle>
          <mat-slide-toggle
            [checked]="sideBySide()"
            (change)="sideBySide.set($event.checked)"
          >
            Two columns
          </mat-slide-toggle>
        </div>
      </div>

      @for (group of groups; track group.title) {
        <div class="preview-section">
          <div class="preview-section__title">{{ group.title }}</div>
          <p class="oc-blurb">{{ group.blurb }}</p>
          <div class="oc-grid" [class.oc-grid--split]="sideBySide()">
            @for (f of group.fixtures; track f.label) {
              <preview-overage-state [fixture]="f" [owner]="owner()" />
            }
          </div>
        </div>
      }
    </preview-doc>
  `,
})
export class OverageCardPreview {
  readonly groups = FIXTURE_GROUPS;
  readonly owner = signal(true);
  readonly sideBySide = signal(false);

  readonly dos = [
    "Name the cause the customer can act on, and say plainly when there isn't one.",
    "Hide the cap editor where the server would reject the change, and say why.",
    "Distinguish a plan that cannot be billed from billing that is not running: the first is theirs to fix, the second is ours.",
  ];
  readonly donts = [
    "Point at the spend cap in any state where raising it cannot restore ingestion.",
    "Wait for the throttle sweep to describe a problem the status already reports.",
  ];
}
