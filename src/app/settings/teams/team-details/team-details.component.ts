import { Component, input, ChangeDetectionStrategy } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { MatTabsModule } from "@angular/material/tabs";
import { MatIconModule } from "@angular/material/icon";
import { MatButtonModule } from "@angular/material/button";
import { PageHeaderComponent } from "src/app/shared/detail/page-header/page-header.component";
import { BackLinkComponent } from "src/app/shared/detail/back-link/back-link.component";
import { TopAppBar } from "src/app/shared/top-app-bar/top-app-bar";

@Component({
  templateUrl: "./team-details.component.html",
  styleUrls: ["./team-details.component.scss"],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [
    MatButtonModule,
    RouterLink,
    MatIconModule,
    MatTabsModule,
    RouterLinkActive,
    RouterOutlet,
    PageHeaderComponent,
    BackLinkComponent,
    TopAppBar,
  ],
})
export class TeamDetailsComponent {
  orgSlug = input.required<string>({ alias: "org-slug" });
  teamSlug = input.required<string>({ alias: "team-slug" });
  navLinks = [
    {
      path: "members",
      label: "Members",
    },
    {
      path: "projects",
      label: "Projects",
    },
    {
      path: "settings",
      label: "Settings",
    },
  ];
}
