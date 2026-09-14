import {
  Component,
  ChangeDetectionStrategy,
  Input,
  HostBinding,
  computed,
  input,
} from "@angular/core";
import type {
  ProjectCardButtonWithQuery,
  ProjectCardButton,
} from "../shared.interfaces";
import { MatCardModule } from "@angular/material/card";
import { MatIconModule } from "@angular/material/icon";
import { RouterModule } from "@angular/router";
import { MatTooltipModule } from "@angular/material/tooltip";
import { MatButtonModule } from "@angular/material/button";
import { MatDividerModule } from "@angular/material/divider";
import { UpperCasePipe } from "@angular/common";
import { SparklineComponent, SparklineDataPoint } from "../sparkline/sparkline";
import { OBJECT_ICON } from "../object-identity/object-identity";
import { platformIconUrl } from "../object-attributes/platform-icon";

@Component({
  selector: "gt-project-card",
  imports: [
    UpperCasePipe,
    MatCardModule,
    MatIconModule,
    RouterModule,
    MatTooltipModule,
    MatButtonModule,
    MatDividerModule,
    SparklineComponent,
  ],
  templateUrl: "./project-card.component.html",
  styleUrls: ["./project-card.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCardComponent {
  /** The Project object's identity glyph, from the shared token. */
  protected readonly projectIcon = OBJECT_ICON.project;

  readonly cardLink = input<string | unknown[]>();
  readonly cardLinkQueryParams = input<{
    [k: string]: unknown;
  }>();
  readonly title = input<string>();
  readonly descriptionList = input<
    {
      key: string;
      value: string;
    }[]
  >();
  readonly isMember = input<boolean>();

  @Input() primaryButton?: ProjectCardButtonWithQuery;
  @Input() secondaryButton?: ProjectCardButton;

  readonly badge = input<string>();
  readonly issueCount = input<number>();
  /** Use the compact "Issues · ⚙" footer even without a live count (for the
   *  Projects page, whose global endpoint carries no per-project stats). */
  readonly compact = input(false);
  /** Flat filled tile (no outline) — for use inside a containing card, so the
   *  cards don't double-border with the container. */
  readonly flat = input(false);
  /** Project platform slug (e.g. "python-django") — renders its logo. */
  readonly platform = input<string | null | undefined>(null);
  protected readonly platformIcon = computed(() =>
    platformIconUrl(this.platform()),
  );
  readonly errorStats = input<SparklineDataPoint[]>();
  readonly responseTime = input<number | null>();
  readonly errorTotal = computed(() =>
    (this.errorStats() ?? []).reduce((sum, p) => sum + p.value, 0),
  );
  readonly sampleCard = input(false);

  @HostBinding("class.sample-card") get isSampleCard() {
    return this.sampleCard();
  }
}
