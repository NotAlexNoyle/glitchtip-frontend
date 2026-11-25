import {
  Component,
  inject,
  Input,
  input,
  output,
  signal,
  ChangeDetectionStrategy,
} from "@angular/core";
import { BreakpointObserver } from "@angular/cdk/layout";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatOptionModule } from "@angular/material/core";
import { MatSelectChange, MatSelectModule } from "@angular/material/select";
import { MatIconModule } from "@angular/material/icon";
import { MatChipsModule } from "@angular/material/chips";
import { MatMenuModule } from "@angular/material/menu";
import { SelectGhostDirective } from "src/app/shared/select-ghost.directive";
import { FilterSearchComponent } from "src/app/shared/filter-search/filter-search";

/** Wide enough for the issue list's Trend column; the trend control shows from here too. */
export const TREND_MEDIA_QUERY = "(min-width: 1080px)";

export interface SearchHelpSection {
  title: string;
  // Clickable chips — use for bounded enums (status, level).
  examples?: string[];
  // Inline code samples — use when values are unbounded (tags, free text).
  samples?: string[];
  note?: string;
  // When true, clicking a chip replaces any same-prefix token (e.g. is:*).
  mutuallyExclusive?: boolean;
}

export interface SearchHelpConfig {
  heading: string;
  sections: SearchHelpSection[];
  footer?: string;
}

@Component({
  selector: "gt-data-filter-bar",
  imports: [
    MatButtonModule,
    ReactiveFormsModule,
    MatOptionModule,
    MatSelectModule,
    SelectGhostDirective,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    FilterSearchComponent,
  ],
  templateUrl: "./data-filter-bar.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  // The band and its row are global; see _filter-bar.scss.
  host: { class: "gt-filter-band" },
})
export class DataFilterBarComponent {
  @Input() sortForm?: FormGroup;
  readonly sorts = input<
    {
      param: string;
      display: string;
    }[]
  >();
  currentStatsPeriod = input<"24h" | "14d">();
  @Input() environmentForm?: FormGroup;
  @Input() searchForm?: FormGroup;
  readonly searchHelp = input<SearchHelpConfig>();
  /** The band is off the page's default, so search offers Clear filters. */
  readonly filtersActive = input(false);
  readonly clearFilters = output();
  protected breakPointObserver = inject(BreakpointObserver);
  readonly organizationEnvironments = input<string[]>([]);
  statsPeriodToggleDisabled = input(true);
  onStatsPeriodToggle = output<"24h" | "14d">();

  readonly filterByEnvironment = output<MatSelectChange>();
  readonly searchSubmit = output();
  readonly sortByChanged = output<MatSelectChange>();

  showTrend = signal(true);

  searchControl() {
    return this.searchForm?.get("query") as FormControl<string | null>;
  }

  /** The chosen sort's name, for the ghost select's trigger. */
  sortLabel() {
    const param = this.sortForm?.get("sort")?.value;
    return this.sorts()?.find((s) => s.param === param)?.display ?? "";
  }

  constructor() {
    this.breakPointObserver
      .observe(TREND_MEDIA_QUERY)
      .subscribe((result) => this.showTrend.set(result.matches));
  }

  isTokenActive(token: string): boolean {
    const current = (
      (this.searchForm?.get("query")?.value ?? "") as string
    ).trim();
    if (!current) return false;
    return current.split(/\s+/).includes(token);
  }

  toggleSearchToken(token: string, mutuallyExclusive = false) {
    const control = this.searchForm?.get("query");
    if (!control) return;
    const tokens = ((control.value ?? "") as string)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (tokens.includes(token)) {
      control.setValue(tokens.filter((t) => t !== token).join(" "));
    } else {
      const prefix = token.split(":")[0];
      const isStructured = token.includes(":");
      const kept = mutuallyExclusive
        ? tokens.filter((t) => !t.includes(":") || t.split(":")[0] !== prefix)
        : tokens;
      // Structured tokens go before bare words; the backend stops parsing
      // filters after the first plain word.
      const firstBareIdx = isStructured
        ? kept.findIndex((t) => !t.includes(":"))
        : -1;
      const next =
        firstBareIdx < 0
          ? [...kept, token]
          : [
              ...kept.slice(0, firstBareIdx),
              token,
              ...kept.slice(firstBareIdx),
            ];
      control.setValue(next.join(" "));
    }

    this.searchSubmit.emit();
  }
}
