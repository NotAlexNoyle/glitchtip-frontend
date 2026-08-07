import {
  Component,
  OnInit,
  computed,
  inject,
  effect,
  ChangeDetectionStrategy,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map } from "rxjs/operators";
import {
  Validators,
  ReactiveFormsModule,
  FormGroup,
  FormControl,
} from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatCardModule } from "@angular/material/card";
import { MarkdownComponent, provideMarkdown } from "ngx-markdown";
import { FormErrorComponent } from "../shared/forms/form-error/form-error.component";
import { LoginWebAuthnComponent } from "./login-webauthn/login-webauthn.component";
import { LoginTotpComponent } from "./login-totp/login-totp.component";
import { LoadingButtonComponent } from "../shared/loading-button/loading-button.component";
import { mapFormErrors } from "../shared/forms/form.utils";
import { StatefulComponent } from "../shared/stateful-service/signal-state.component";
import { LoginService, LoginState } from "./login.service";
import { SettingsService } from "../api/settings.service";
import { AuthSvgComponent } from "../shared/auth-svg/auth-svg.component";
import { MatSnackBar } from "@angular/material/snack-bar";
import { components } from "../api/api-schema";
import { apiResource } from "../shared/api/api-resource-factory";

type SocialApp = components["schemas"]["SocialAppSchema"];

@Component({
  selector: "gt-login",
  templateUrl: "./login.html",
  styleUrls: ["./login.scss"],
  imports: [
    MatCardModule,
    MarkdownComponent,
    LoginTotpComponent,
    LoginWebAuthnComponent,
    LoadingButtonComponent,
    ReactiveFormsModule,
    FormErrorComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    AuthSvgComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  providers: [provideMarkdown()],
})
export class LoginComponent
  extends StatefulComponent<LoginState, LoginService>
  implements OnInit
{
  protected service: LoginService;
  private settings = inject(SettingsService);
  private activatedRoute = inject(ActivatedRoute);
  private snackBar = inject(MatSnackBar);

  formErrors = this.service.formErrors;
  loading = this.service.loading;
  requiresMFA = this.service.requiresMfa;
  hasWebAuthn = this.service.hasWebAuthn;
  preferTOTP = this.service.preferTOTP;
  form = new FormGroup({
    email: new FormControl("", [Validators.required, Validators.email]),
    password: new FormControl("", [
      Validators.required,
      Validators.minLength(8),
    ]),
  });
  instanceName = this.settings.instanceName;

  /** Set on the per-organization login page (/login/<org slug>) */
  orgSlug = toSignal(
    this.activatedRoute.paramMap.pipe(map((params) => params.get("org-slug"))),
  );
  private orgLoginSettingsResource = apiResource(this.orgSlug, (slug) => ({
    url: "/api/settings/{organization_slug}/",
    options: { params: { path: { organization_slug: slug } } },
  }));

  socialApps = computed(() =>
    this.orgSlug()
      ? (this.orgLoginSettingsResource.value()?.socialApps ?? [])
      : this.settings.socialApps(),
  );
  orgLoginSettingsLoaded = computed(() =>
    this.orgLoginSettingsResource.hasValue(),
  );

  enableUserRegistration = this.settings.enableUserRegistration;
  enableSocialAppsUserRegistration =
    this.settings.enableSocialAppsUserRegistration;

  constructor() {
    const service = inject(LoginService);

    effect(() => {
      mapFormErrors(service.fieldErrors(), this.form);
    });

    super(service);

    this.service = service;
  }

  ngOnInit() {
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params["socialLoginError"]) {
        this.snackBar.open(
          $localize`Unknown problem using Social Authentication`,
        );
      }
    });
  }

  get email() {
    return this.form.get("email");
  }

  get password() {
    return this.form.get("password");
  }

  onSocialApp(socialApp: SocialApp) {
    this.service.socialLogin(socialApp.provider);
  }

  onSubmit() {
    if (this.form.valid) {
      this.service.login(this.form.value.email!, this.form.value.password!);
    }
  }
}
