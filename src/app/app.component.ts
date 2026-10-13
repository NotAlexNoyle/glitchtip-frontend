import {
  Component,
  OnInit,
  effect,
  inject,
  ChangeDetectionStrategy,
} from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { SettingsService } from "./api/settings.service";
import { UserService } from "./api/user/user.service";
import { setTheme } from "./shared/shared.utils";
import { AuthService } from "./auth.service";
import { MatIconRegistry } from "@angular/material/icon";

@Component({
  selector: "gt-root",
  templateUrl: "./app.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterOutlet],
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private userService = inject(UserService);
  private matIconRegistry = inject(MatIconRegistry);

  constructor() {
    // Start settings at boot: it configures error reporting for the app.
    inject(SettingsService);
    effect(() =>
      setTheme(
        this.userService.user()?.options.preferredTheme ||
          localStorage.getItem("theme"),
      ),
    );
  }

  ngOnInit() {
    this.matIconRegistry.setDefaultFontSetClass("material-symbols-filled");
    const systemTheme = matchMedia("(prefers-color-scheme: dark)");
    systemTheme.addEventListener("change", () =>
      setTheme(this.userService.user()?.options.preferredTheme),
    );

    this.authService.checkServerAuthStatus();
  }
}
