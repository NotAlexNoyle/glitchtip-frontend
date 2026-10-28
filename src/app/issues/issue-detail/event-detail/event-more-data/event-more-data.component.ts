import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { PanelComponent } from "src/app/shared/panel/panel.component";
import { IssueDetailService } from "../../issue-detail.service";
import { Json } from "src/app/interface-primitives";
import { PropertyRow, toRows, toggled } from "../event-format";

interface Group {
  label: string;
  rows: PropertyRow[];
}

interface Source {
  key: string;
  label: string;
  count: number | null;
  summary: string;
  groups: Group[];
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
                (click)="toggle(s.key)"
              >
                <span class="gt-kv__k"
                  >{{ s.label }}
                  @if (s.count !== null) {
                    <span class="gt-kv__count">{{ s.count }}</span>
                  }
                </span>
                <span class="gt-kv__v gt-truncate gt-muted">{{
                  s.summary
                }}</span>
                <mat-icon class="gt-chev" aria-hidden="true">{{
                  isOpen ? "keyboard_arrow_down" : "keyboard_arrow_right"
                }}</mat-icon>
              </button>
              @if (isOpen) {
                <div class="gt-groups">
                  @for (g of s.groups; track g.label) {
                    <div class="gt-group">
                      @if (s.groups.length > 1) {
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
    :host {
      display: block;
    }

    :host:empty {
      display: none;
    }

    .gt-groups {
      padding-top: var(--gt-space-1, 4px);
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
      const rows = toRows(user);
      out.push({
        key: "user",
        label: $localize`User`,
        count: null,
        summary: rows
          .filter((r) => !r.value.startsWith("{"))
          .map((r) => r.value)
          .join(" · "),
        groups: [{ label: $localize`User`, rows }],
      });
    }

    const contexts = (event.contexts ?? {}) as {
      [key: string]: { [key: string]: Json } | null;
    };
    const names = Object.keys(contexts).sort();
    if (names.length) {
      out.push({
        key: "contexts",
        label: $localize`Contexts`,
        count: names.length,
        summary: names.join(", "),
        groups: names.map((name) => {
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
        groups: [{ label: $localize`Additional data`, rows: toRows(extra) }],
      });
    }

    const sdk = event.sdk as { [key: string]: Json } | null;
    if (sdk) {
      const integrations = Array.isArray(sdk["integrations"])
        ? sdk["integrations"].length
        : 0;
      const packages = Array.isArray(sdk["packages"])
        ? (sdk["packages"] as { name: string; version: string }[])
            .map((p) => `${p.name} ${p.version}`)
            .join(", ")
        : null;
      const rows = toRows(sdk, ["packages", "integrations"]);
      if (packages) rows.push({ key: "packages", value: packages, long: true });
      if (integrations) {
        rows.push({
          key: "integrations",
          value: (sdk["integrations"] as string[]).join(", "),
          long: true,
        });
      }
      out.push({
        key: "sdk",
        label: "SDK",
        count: null,
        summary: [
          [sdk["name"], sdk["version"]].filter(Boolean).join(" "),
          integrations
            ? integrations === 1
              ? $localize`1 integration`
              : $localize`${integrations} integrations`
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
        groups: [{ label: "SDK", rows }],
      });
    }
    return out;
  });

  readonly opened = linkedSignal(() => {
    this.sources();
    return new Set<string>();
  });

  toggle(key: string) {
    this.opened.set(toggled(this.opened(), key));
  }
}
