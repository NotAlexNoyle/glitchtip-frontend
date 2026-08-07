import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { Autofocus } from "../shared/autofocus";

// Discovery page for private (organization-only) SSO providers. Organizations
// are not listed publicly, so the user supplies their own slug and is sent to
// that organization's login page.
@Component({
  selector: "gt-sso-login",
  templateUrl: "./sso-login.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    Autofocus,
  ],
})
export class SsoLogin {
  private router = inject(Router);

  form = new FormGroup({
    orgSlug: new FormControl("", [Validators.required]),
  });

  get orgSlug() {
    return this.form.get("orgSlug");
  }

  onSubmit() {
    const slug = this.form.value.orgSlug?.trim();
    if (!slug) {
      this.orgSlug!.setErrors({ required: true });
      this.orgSlug!.markAsTouched();
      return;
    }
    this.router.navigate(["/login", slug]);
  }
}
