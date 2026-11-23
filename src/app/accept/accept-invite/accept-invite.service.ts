import { Injectable, computed, effect, inject, signal } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { apiErrorMessage, client } from "src/app/shared/api/api";
import { OrganizationsService } from "src/app/api/organizations.service";
import { apiResource } from "src/app/shared/api/api-resource-factory";

@Injectable({ providedIn: "root" })
export class AcceptInviteService {
  #snackBar = inject(MatSnackBar);
  #organizationsService = inject(OrganizationsService);
  #router = inject(Router);

  #params = signal<{ memberID: number; token: string } | undefined>(undefined);
  inviteAcceptDetail = apiResource(this.#params, (params) => ({
    url: "/api/0/accept/{org_user_id}/{token}/",
    options: {
      params: {
        path: {
          org_user_id: params.memberID,
          token: params.token,
        },
      },
    },
  }));
  acceptInfo = computed(() => this.inviteAcceptDetail.value());
  orgSlug = computed(() => this.acceptInfo()?.orgUser.organization.slug);
  alreadyInOrg = computed(() => {
    const orgSlugToMatch = this.orgSlug();
    const organizations = this.#organizationsService.organizations();

    if (orgSlugToMatch) {
      const match = organizations.find(
        (organization) => organization.slug === orgSlugToMatch,
      );
      if (match) {
        return true;
      }
      return false;
    }
    return false;
  });

  constructor() {
    effect(() => {
      // On error, show message and navigate to /
      const errors = this.inviteAcceptDetail.serverError();
      if (errors?.detail.length) {
        this.#snackBar.open(errors?.detail[0].msg);
        this.#router.navigate(["/"]);
      }
    });
  }

  setParams(memberID: number, token: string) {
    this.#params.set({ memberID, token });
  }

  async acceptInvite(memberId: number, token: string) {
    const { response, data, error } = await client.POST(
      "/api/0/accept/{org_user_id}/{token}/",
      {
        params: {
          path: {
            org_user_id: memberId,
            token,
          },
        },
        body: { acceptInvite: true },
      },
    );
    if (data) {
      this.#organizationsService.reload();
      this.#snackBar.open(
        $localize`You have been added to ${data.orgUser.organization.name}.`,
      );
      this.#router.navigate(["/"]);
    }
    // Read before narrowing: the schema declares no error responses
    const status = response.status;
    if (error) {
      // A 500 here is almost always the member unique constraint: already joined
      const fallback =
        status >= 500
          ? $localize`There was an error, probably because you tried to join an organization that you're already a part of.`
          : $localize`This invitation link expired or is invalid. Please issue a new invitation request.`;
      this.#snackBar.open(apiErrorMessage(error, response, fallback));
    }
  }
}
