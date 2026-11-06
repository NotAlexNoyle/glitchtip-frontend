import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { LinksService } from "./links.service";
import { MatFormFieldModule } from "@angular/material/form-field";
import { RouterLink } from "@angular/router";
import { PaymentComponent } from "./shared/payment/payment.component";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { FeatureSwitcherComponent } from "./shared/feature-switcher/feature-switcher.component";
import { RevealDirective } from "./shared/reveal.directive";
import { ImagesReadyDirective } from "./shared/images-ready.directive";
import { GridDriftComponent } from "./shared/grid-drift/grid-drift.component";
import { BugSceneComponent } from "./shared/bug-scene/bug-scene.component";
import { EventFlowComponent } from "./shared/event-flow/event-flow.component";

@Component({
  selector: "marketing-home",
  imports: [
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    RouterLink,
    PaymentComponent,
    FeatureSwitcherComponent,
    RevealDirective,
    ImagesReadyDirective,
    GridDriftComponent,
    BugSceneComponent,
    EventFlowComponent,
  ],
  templateUrl: "./home.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ["./home.component.scss"],
})
export class HomeComponent {
  private links = inject(LinksService);

  registerLink = this.links.registerLink;

  // Overshoots both hairlines so the band clips envelopes in and out.
  protected readonly mailRoute =
    "M20 -24 V96 q0 12 12 12 H108 q12 0 12 12 V250 q0 12 -12 12 H44 q-12 0 -12 12 V600";
}
