import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDialog } from "@angular/material/dialog";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatRadioModule } from "@angular/material/radio";
import { MatSnackBar } from "@angular/material/snack-bar";
import { OrganizationsService } from "src/app/api/organizations.service";
import { SettingsService } from "src/app/api/settings.service";
import { ConfirmDialogComponent } from "src/app/shared/confirm-dialog/confirm-dialog.component";
import { CopyInputComponent } from "src/app/shared/copy-input/copy-input.component";
import { LoadingButtonComponent } from "src/app/shared/loading-button/loading-button.component";
import { TopAppBar } from "src/app/shared/top-app-bar/top-app-bar";
import {
  OrganizationSocialApp,
  OrganizationSocialAppsService,
} from "./organization-social-apps.service";

@Component({
  selector: "gt-organization-auth",
  templateUrl: "./organization-auth.component.html",
  styleUrls: ["./organization-auth.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    ReactiveFormsModule,
    RouterLink,
    CopyInputComponent,
    LoadingButtonComponent,
    TopAppBar,
  ],
})
export class OrganizationAuthComponent {
  private service = inject(OrganizationSocialAppsService);
  private organizationsService = inject(OrganizationsService);
  private settings = inject(SettingsService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  socialApps = this.service.socialApps;
  resourceError = computed(() => this.service.socialAppsResource.serverError());
  loadingApps = computed(() => this.service.socialAppsResource.isLoading());
  accessOrgAdmin = this.organizationsService.accessOrgAdmin;
  billingEnabled = this.settings.billingEnabled;
  orgSlug = this.organizationsService.activeOrganizationSlug;

  showForm = signal(false);
  editingApp = signal<OrganizationSocialApp | null>(null);
  saving = signal(false);
  error = signal<string | null>(null);
  planLimited = signal(false);

  form = new FormGroup({
    provider: new FormControl<"google" | "openid_connect">("google", {
      nonNullable: true,
    }),
    name: new FormControl("", [Validators.required]),
    serverUrl: new FormControl(""),
    clientID: new FormControl("", [Validators.required]),
    clientSecret: new FormControl(""),
    isPublic: new FormControl(false),
  });

  /** The issuer URL only applies to bring-your-own OIDC providers */
  showIssuerField() {
    const editing = this.editingApp();
    if (editing) {
      return editing.brand !== "google";
    }
    return this.form.controls.provider.value === "openid_connect";
  }

  onProviderChange() {
    const name = this.form.controls.name;
    if (this.form.controls.provider.value === "google") {
      if (!name.value) {
        name.setValue("Google");
      }
    } else if (name.value === "Google") {
      name.setValue("");
    }
    this.syncServerUrlValidator();
  }

  private syncServerUrlValidator() {
    const serverUrl = this.form.controls.serverUrl;
    if (this.showIssuerField()) {
      serverUrl.setValidators([Validators.required]);
    } else {
      serverUrl.clearValidators();
    }
    serverUrl.updateValueAndValidity();
  }

  startAdd() {
    this.editingApp.set(null);
    this.error.set(null);
    this.form.reset({ provider: "google", name: "Google", isPublic: false });
    this.form.controls.clientSecret.setValidators([Validators.required]);
    this.form.controls.clientSecret.updateValueAndValidity();
    this.syncServerUrlValidator();
    this.showForm.set(true);
  }

  startEdit(app: OrganizationSocialApp) {
    this.editingApp.set(app);
    this.error.set(null);
    this.form.reset({
      provider: app.brand === "google" ? "google" : "openid_connect",
      name: app.name,
      serverUrl: app.serverUrl,
      clientID: app.clientID,
      clientSecret: "",
      isPublic: app.isPublic,
    });
    this.form.controls.clientSecret.clearValidators();
    this.form.controls.clientSecret.updateValueAndValidity();
    this.syncServerUrlValidator();
    this.showForm.set(true);
  }

  cancelForm() {
    this.showForm.set(false);
    this.editingApp.set(null);
    this.error.set(null);
  }

  async onSubmit() {
    if (!this.form.valid) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.value;
    const payload = {
      provider: value.provider!,
      name: value.name!,
      serverUrl: this.showIssuerField() ? value.serverUrl : null,
      clientID: value.clientID!,
      clientSecret: value.clientSecret ? value.clientSecret : null,
      isPublic: value.isPublic ?? false,
    };
    const editing = this.editingApp();
    const result = editing
      ? await this.service.updateSocialApp(editing.id!, payload)
      : await this.service.createSocialApp(payload);
    this.saving.set(false);
    if (result.success) {
      this.snackBar.open(
        editing
          ? $localize`SSO provider updated`
          : $localize`SSO provider created. Register the callback URL with your identity provider to finish setup.`,
      );
      this.cancelForm();
      return;
    }
    if (result.planLimited) {
      this.planLimited.set(true);
    }
    this.error.set(result.error ?? null);
  }

  removeSocialApp(app: OrganizationSocialApp) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      restoreFocus: false,
      height: "225px",
      width: "375px",
      data: {
        title: $localize`Remove SSO provider`,
        message: $localize`Are you sure you want to remove ${app.name}? Members will no longer be able to sign in with it, but existing accounts are kept.`,
        confirmText: $localize`Remove`,
      },
    });
    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        const result = await this.service.deleteSocialApp(app.id!);
        if (result.success) {
          this.snackBar.open($localize`SSO provider removed`);
        } else if (result.error) {
          this.snackBar.open(result.error);
        }
      }
    });
  }
}
