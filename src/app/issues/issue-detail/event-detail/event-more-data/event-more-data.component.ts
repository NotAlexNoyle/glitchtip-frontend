import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { IssueDetailService } from "../../issue-detail.service";
import { Json } from "src/app/interface-primitives";
import { PropertyRow, str, toRows } from "../event-format";
import { openKeys } from "src/app/shared/signal.utils";

interface Group {
  label: string;
  rows: PropertyRow[];
}

interface Source {
  key: string;
  label: string;
  count: number | null;
  summary: string;
  /** SDK only: how many integrations it runs. */
  integrations?: number;
  /** Formatted on first open. */
  groups: () => Group[];
}

/** User, contexts, additional data and SDK as collapsed rows: the raw sources. */
@Component({
  selector: "gt-event-more-data",
  imports: [PanelComponent, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (sources().length) {
      <gt-panel
        flush
        i18n-title
        title="More event data"
        i18n-subtitle
        subtitle="raw sources"
      >
        <div class="gt-kv">
          @for (s of sources(); track s.key) {
            @let isOpen = opened().has(s.key);
            <div class="gt-kv__group">
              <button
                type="button"
                class="gt-kv__row gt-expandable-row"
                [attr.aria-expanded]="isOpen"
                (click)="opened.toggle(s.key)"
              >
                <span class="gt-kv__k"
                  >{{ s.label }}
                  @if (s.count !== null) {
                    <span class="gt-kv__count">{{ s.count }}</span>
                  }
                </span>
                <span class="gt-kv__v gt-truncate gt-muted"
                  >{{ s.summary }}
                  @if (s.integrations) {
                    <span
                      class="integrations"
                      [class.integrations--after]="!!s.summary"
                      i18n
                      >{s.integrations, plural,
                        =1 {1 integration}
                        other {
                          {{ s.integrations // i18n(ph="count") }} integrations
                        }
                      }</span
                    >
                  }
                </span>
                <mat-icon class="gt-chev" aria-hidden="true"
                  >keyboard_arrow_right</mat-icon
                >
              </button>
              @if (openedGroups().get(s.key); as groups) {
                <div class="gt-groups">
                  @for (g of groups; track g.label) {
                    <div class="gt-group">
                      @if (groups.length > 1) {
                        <div class="gt-group__label">{{ g.label }}</div>
                      }
                      <dl class="gt-property-list gt-property-list--group">
                        @for (kv of g.rows; track kv.key) {
                          <div
                            class="gt-property-list__row"
                            [class.gt-property-list__row--long]="kv.long"
                          >
                            <dt class="gt-mono">{{ kv.key }}</dt>
                            <dd class="gt-mono">{{ kv.value }}</dd>
                          </div>
                        }
                      </dl>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </gt-panel>
    }
  `,
  styles: `
    @use "controls";
    @use "row-mixins" as rows;

    .gt-groups {
      padding-block: var(--gt-space-1, 4px);
    }

    .gt-group + .gt-group {
      @include rows.inset-hairline(16px);
    }

    .gt-kv__group .gt-group + .gt-group {
      @include rows.inset-hairline(32px);
    }

    .gt-group__label {
      padding: var(--gt-space-2, 8px) var(--gt-space-4, 16px) 0
        var(--gt-indent, var(--gt-space-4, 16px));
      font: var(--mat-sys-label-medium);
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }

    .gt-property-list--group {
      padding-block: 0 var(--gt-space-2, 8px);

      .gt-property-list__row {
        min-height: 28px;
        padding-inline-start: var(--gt-indent, var(--gt-space-4, 16px));
      }
    }

    .integrations--after::before {
      @include controls.middot(var(--gt-space-1, 4px));
    }
  `,
})
export class EventMoreDataComponent {
  private issueService = inject(IssueDetailService);

  readonly sources = computed<Source[]>(() => {
    const event = this.issueService.event();
    if (!event) return [];
    const out: Source[] = [];

    const user = event.user as { [key: string]: Json } | null;
    if (user && Object.keys(user).length) {
      out.push({
        key: "user",
        label: $localize`User`,
        count: null,
        summary: Object.values(user).map(str).filter(Boolean).join(" · "),
        groups: () => [{ label: $localize`User`, rows: toRows(user) }],
      });
    }

    const contexts = (event.contexts ?? {}) as {
      [key: string]: { [key: string]: Json } | null;
    };
    const names = Object.keys(contexts)
      .filter((name) => toRows(contexts[name], ["type"]).length)
      .sort();
    if (names.length) {
      out.push({
        key: "contexts",
        label: $localize`Contexts`,
        count: names.length,
        summary: names.join(", "),
        groups: () =>
          names.map((name) => {
            const ctx = contexts[name];
            const type = ctx?.["type"];
            return {
              label: type && type !== name ? `${name} (${type})` : name,
              rows: toRows(ctx, ["type"]),
            };
          }),
      });
    }

    const extra = event.context as { [key: string]: Json } | null;
    if (extra && Object.keys(extra).length) {
      const keys = Object.keys(extra);
      out.push({
        key: "extra",
        label: $localize`Additional data`,
        count: keys.length,
        summary: keys.join(", "),
        groups: () => [
          { label: $localize`Additional data`, rows: toRows(extra) },
        ],
      });
    }

    // The SDK's own event id, so app logs can be matched.
    const sdk = (event.sdk ?? {}) as { [key: string]: Json };
    if (Object.keys(sdk).length || event.eventID) {
      const integrations = Array.isArray(sdk["integrations"])
        ? (sdk["integrations"] as string[])
        : [];
      out.push({
        key: "sdk",
        label: "SDK",
        count: null,
        summary: [str(sdk["name"]), str(sdk["version"])]
          .filter(Boolean)
          .join(" "),
        integrations: integrations.length,
        groups: () => {
          const rows = toRows(sdk, ["packages", "integrations"]);
          if (event.eventID) {
            rows.unshift({ key: "event_id", value: event.eventID, long: true });
          }
          if (Array.isArray(sdk["packages"])) {
            const packages = sdk["packages"] as {
              name: string;
              version: string;
            }[];
            rows.push({
              key: "packages",
              value: packages.map((p) => `${p.name} ${p.version}`).join(", "),
              long: true,
            });
          }
          if (integrations.length) {
            rows.push({
              key: "integrations",
              value: integrations.join(", "),
              long: true,
            });
          }
          return [{ label: "SDK", rows }];
        },
      });
    }
    return out;
  });

  readonly opened = openKeys(this.sources);

  readonly openedGroups = computed(() => {
    const opened = this.opened();
    const groups = new Map<string, Group[]>();
    for (const s of this.sources()) {
      if (opened.has(s.key)) groups.set(s.key, s.groups());
    }
    return groups;
  });
}
