import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import {
  ISSUE_LEVEL,
  ISSUE_STATUS,
  IssueLevel,
  IssueStatus,
  OBJECT_ICON,
  ObjectType,
} from "src/app/shared/object-identity/object-identity";
import { ApiRow, PreviewDocComponent } from "../docs/preview-doc.component";

/**
 * Object identity: the tokens that decide how a domain object presents itself.
 * Not a component; a source of truth surfaces read from.
 */
@Component({
  selector: "preview-object-identity",
  imports: [MatIconModule, PreviewDocComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .oi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: var(--gt-space-3);
      }
      .oi-item {
        display: flex;
        align-items: center;
        gap: var(--gt-space-2);
        padding: var(--gt-space-2) var(--gt-space-3);
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
      }
      .oi-item__name {
        font-family: var(--gt-font-mono, monospace);
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
      // Mirrors the list row's accent geometry: left, 3px, full height.
      .oi-level {
        position: relative;
        padding: var(--gt-space-2) var(--gt-space-3) var(--gt-space-2)
          var(--gt-space-4);
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 8px;
        overflow: hidden;
      }
      .oi-level::after {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background-color: var(--gt-level-accent, var(--mat-sys-outline));
      }
      .oi-level.is-striped::after {
        background-color: transparent;
        background-image: repeating-linear-gradient(
          -60deg,
          var(--mat-sys-error),
          var(--mat-sys-error) 5px,
          var(--mat-sys-surface) 5px,
          var(--mat-sys-surface) 10px
        );
      }
      .oi-level__label {
        font-weight: 500;
      }
      .oi-level__meta {
        font-family: var(--gt-font-mono, monospace);
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
  template: `
    <preview-doc
      title="Object identity"
      status="stable"
      description="The single source of truth for how a domain object presents itself: its icon, its accent colour, and how an Issue's level and status map to visual tokens. Identity belongs to the object, not to the component that renders it, so every surface reads from here."
      [whenToUse]="whenToUse"
      [dos]="dos"
      [donts]="donts"
      a11y="Level and status are never colour-only: each token carries a label, so a surface can give an accessible name alongside the accent or glyph."
      [api]="api"
      [importCode]="importCode"
      [code]="code"
    >
      <div class="preview-section">
        <div class="preview-section__title">Object icons</div>
        <p class="preview-section__note">
          One glyph per object type, reused wherever that object appears. These
          are the icons the product already uses, which keeps them inside the
          subset Material Symbols font the app ships.
        </p>
        <div class="oi-grid">
          @for (o of objects; track o) {
            <div class="oi-item">
              <mat-icon>{{ icon(o) }}</mat-icon>
              <span class="oi-item__name">{{ o }}</span>
            </div>
          }
        </div>
      </div>

      <div class="preview-section">
        <div class="preview-section__title">Issue levels</div>
        <p class="preview-section__note">
          Severity ascending. The accent is bound through the
          <code>--gt-level-accent</code> custom property; fatal is the one
          exceptional treatment, a striped gradient rather than a flat colour.
        </p>
        @for (l of levels; track l) {
          <div
            class="oi-level"
            [class.is-striped]="level(l).striped"
            [style.--gt-level-accent]="level(l).color"
            style="margin-bottom: 8px"
          >
            <div class="oi-level__label">{{ level(l).label }}</div>
            <div class="oi-level__meta"
              >{{ l }} · severity {{ level(l).severity }}</div
            >
          </div>
        }
      </div>

      <div class="preview-section">
        <div class="preview-section__title">Issue status</div>
        <p class="preview-section__note">
          The glyph a status wears. The same icon is used for the matching
          action verb, so the state and the verb read as the same thing.
        </p>
        <div class="oi-grid">
          @for (s of statuses; track s) {
            <div class="oi-item">
              <mat-icon>{{ status(s).icon }}</mat-icon>
              <span>{{ status(s).label }}</span>
            </div>
          }
        </div>
      </div>
    </preview-doc>
  `,
})
export class ObjectIdentityPreview {
  protected readonly objects = Object.keys(OBJECT_ICON) as ObjectType[];
  protected readonly levels = Object.keys(ISSUE_LEVEL) as IssueLevel[];
  protected readonly statuses = Object.keys(ISSUE_STATUS) as IssueStatus[];

  protected icon(o: ObjectType) {
    return OBJECT_ICON[o];
  }
  protected level(l: IssueLevel) {
    return ISSUE_LEVEL[l];
  }
  protected status(s: IssueStatus) {
    return ISSUE_STATUS[s];
  }

  protected readonly whenToUse = [
    "Any surface that shows an issue's level or status: a list row, a detail header, a summary.",
    "Any surface that names or points at a domain object and needs its glyph.",
    "Deriving 'most severe wins' across a collection, using the severity ordering.",
  ];

  protected readonly dos = [
    "Read the colour, icon and label from the token; bind the colour through --gt-level-accent.",
    "Keep your own accent geometry; the bar's position and size belong to the surface.",
    "Use the token's label for the accessible name so level is never colour-only.",
  ];

  protected readonly donts = [
    "Don't re-declare level colours or status icons in a component's SCSS or a local const.",
    "Don't hardcode a Material glyph for an object that already has one in OBJECT_ICON.",
    "Don't add an icon outside the shipped subset font; it renders as literal ligature text.",
  ];

  protected readonly api: ApiRow[] = [
    {
      name: "OBJECT_ICON",
      type: "Record<ObjectType, string>",
      description: "Material glyph per domain object type.",
    },
    {
      name: "ISSUE_LEVEL",
      type: "Record<IssueLevel, LevelToken>",
      description:
        "Colour, label, severity ordering and striped flag per level.",
    },
    {
      name: "ISSUE_STATUS",
      type: "Record<IssueStatus, StatusToken>",
      description: "Icon and label per issue status.",
    },
    {
      name: "issueLevelToken(level)",
      type: "(string | null) => LevelToken",
      description:
        "Resolves an untyped API level string, falling back to error.",
    },
    {
      name: "issueStatusToken(status)",
      type: "(string | null) => StatusToken",
      description:
        "Resolves an untyped API status string, falling back to unresolved.",
    },
  ];

  protected readonly importCode = `import {
  ISSUE_LEVEL,
  issueLevelToken,
  issueStatusToken,
  OBJECT_ICON,
} from "src/app/shared/object-identity/object-identity";`;

  protected readonly code = `<!-- bind the accent, keep your own bar geometry -->
<td
  class="level"
  [class.is-striped]="levelToken(row.level).striped"
  [style.--gt-level-accent]="levelToken(row.level).color"
></td>`;
}
