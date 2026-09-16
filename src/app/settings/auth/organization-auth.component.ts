import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { MatDialog } from "@angular/material/dialog";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatRadioModule } from "@angular/material/radio";
import { MatSnackBar } from "@angular/material/snack-bar";
import { OrganizationsService } from "src/app/api/organizations.service";
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
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  socialApps = this.service.socialApps;
  /**
   * Any failure to load: a permission denial, a 500, or a dropped connection.
   * serverError() alone misses the last -- a rejected fetch never becomes a
   * ninja error body, so the page would fall through to "none configured".
   */
  resourceError = computed(
    () => this.service.socialAppsResource.error() !== undefined,
  );
  loadingApps = computed(() => this.service.socialAppsResource.isLoading());
  accessOrgWrite = this.organizationsService.accessOrgWrite;
  orgSlug = this.organizationsService.activeOrganizationSlug;

  constructor() {
    // Keep the page's resource keyed to the active org only while mounted
    effect(() => {
      const slug = this.orgSlug();
      if (slug) {
        this.service.setOrganization(slug);
      }
    });
  }

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
    this.planLimited.set(false);
    this.form.reset({ provider: "google", name: "Google" });
    this.form.controls.clientSecret.setValidators([Validators.required]);
    this.form.controls.clientSecret.updateValueAndValidity();
    this.syncServerUrlValidator();
    this.showForm.set(true);
  }

  startEdit(app: OrganizationSocialApp) {
    this.editingApp.set(app);
    this.error.set(null);
    this.planLimited.set(false);
    this.form.reset({
      provider: app.brand === "google" ? "google" : "openid_connect",
      name: app.name,
      serverUrl: app.serverUrl,
      clientID: app.clientID,
      clientSecret: "",
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
    this.planLimited.set(false);
  }

  async onSubmit() {
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    const value = this.form.value;
    const payload = {
      name: value.name!,
      serverUrl: this.showIssuerField() ? value.serverUrl : null,
      clientID: value.clientID!,
    };
    const editing = this.editingApp();
    const result = editing
      ? // provider is deliberately absent from the update payload: it fixes
        // the callback URL already registered at the identity provider.
        await this.service.updateSocialApp(editing.id!, {
          ...payload,
          clientSecret: value.clientSecret ? value.clientSecret : null,
        })
      : await this.service.createSocialApp({
          ...payload,
          provider: value.provider!,
          clientSecret: value.clientSecret!,
        });
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
