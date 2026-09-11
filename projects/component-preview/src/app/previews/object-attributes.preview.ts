import { ChangeDetectionStrategy, Component } from "@angular/core";
import { CountComponent } from "src/app/shared/object-attributes/count.component";
import { PercentComponent } from "src/app/shared/object-attributes/percent.component";
import { ApiRow, PreviewDocComponent } from "../docs/preview-doc.component";

/**
 * Object attributes: one canonical rendering per attribute type, so a count
 * looks like a count and a percentage like a percentage on every object.
 */
@Component({
  selector: "preview-object-attributes",
  imports: [CountComponent, PercentComponent, PreviewDocComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .oa-table {
        width: 100%;
        border-collapse: collapse;
      }
      .oa-table th {
        text-align: left;
        font-weight: 500;
        color: var(--mat-sys-on-surface-variant);
        padding: var(--gt-space-2);
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .oa-table td {
        padding: var(--gt-space-2);
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }
      .oa-table .num {
        text-align: right;
      }
      .oa-raw {
        font-family: var(--gt-font-mono, monospace);
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
  template: `
    <preview-doc
      title="Object attributes"
      status="stable"
      description="One canonical rendering per attribute type. Counts and percentages use tabular figures so they align in a column, and a count abbreviates at scale so a long number stays scannable in a dense table."
      [whenToUse]="whenToUse"
      [dos]="dos"
      [donts]="donts"
      a11y="Abbreviated counts keep the exact value in a title attribute, so the full number is available on hover and to assistive tech."
      [api]="api"
      [importCode]="importCode"
      [code]="code"
    >
      <div class="preview-section">
        <div class="preview-section__title">Count</div>
        <p class="preview-section__note">
          Right-aligned in a numeric column so the ones column lines up and the
          column scans vertically even as magnitudes differ. Abbreviation starts
          at 10,000: below that the exact digits still carry meaning when
          comparing two counts, and the width saved is a character or two.
        </p>
        <table class="oa-table">
          <thead>
            <tr>
              <th>Raw value</th>
              <th class="num">Abbreviated</th>
              <th class="num">Full</th>
            </tr>
          </thead>
          <tbody>
            @for (n of counts; track n) {
              <tr>
                <td class="oa-raw">{{ n }}</td>
                <td class="num"><gt-count [value]="n" /></td>
                <td class="num"
                  ><gt-count [value]="n" [abbreviate]="false"
                /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="preview-section">
        <div class="preview-section__title">Percent</div>
        <p class="preview-section__note">
          Takes a value already on a 0-100 scale. Fixed decimals mean a column
          of percentages keeps the decimal point in one place.
        </p>
        <table class="oa-table">
          <thead>
            <tr>
              <th>Raw value</th>
              <th class="num">1 decimal</th>
              <th class="num">0 decimals</th>
            </tr>
          </thead>
          <tbody>
            @for (p of percents; track p) {
              <tr>
                <td class="oa-raw">{{ p }}</td>
                <td class="num"><gt-percent [value]="p" /></td>
                <td class="num"><gt-percent [value]="p" [decimals]="0" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </preview-doc>
  `,
})
export class ObjectAttributesPreview {
  protected readonly counts = [
    942, 9999, 10000, 45600, 999499, 999999, 1200000, 3400000000,
  ];
  protected readonly percents = [0, 3.2, 47.5, 99.94, 100];

  protected readonly whenToUse = [
    "Any cardinal count: events, users, issues, checks.",
    "Any percentage the app has already computed on a 0-100 scale.",
    "Especially in table columns, where alignment is what makes a column readable.",
  ];

  protected readonly dos = [
    "Right-align counts and percentages in table columns.",
    "Turn abbreviation off where every digit is the point, such as a billing total.",
    "Pass percentages on a 0-100 scale, not a 0-1 fraction.",
  ];

  protected readonly donts = [
    "Don't render a bare number with no separators in a dense column.",
    "Don't hand-roll a percentage with its own toFixed and a literal % sign.",
    "Don't mix decimal specs within one column; pick one and keep it.",
  ];

  protected readonly api: ApiRow[] = [
    {
      name: "[value]",
      type: "number | string | null",
      description:
        "gt-count: the count. A numeric string is accepted, as the API often returns one.",
    },
    {
      name: "[abbreviate]",
      type: "boolean",
      default: "true",
      description:
        "gt-count: shorten at scale (1.2k, 3.4M, 1.2B). The exact value stays on hover.",
    },
    {
      name: "[value]",
      type: "number | null",
      description: "gt-percent: the percentage, already on a 0-100 scale.",
    },
    {
      name: "[decimals]",
      type: "number",
      default: "1",
      description: "gt-percent: decimal places to show.",
    },
  ];

  protected readonly importCode = `import { CountComponent } from "src/app/shared/object-attributes/count.component";
import { PercentComponent } from "src/app/shared/object-attributes/percent.component";`;

  protected readonly code = `<td class="num"><gt-count [value]="row.count" /></td>
<td class="num"><gt-percent [value]="row.uptime" [decimals]="0" /></td>`;
}
