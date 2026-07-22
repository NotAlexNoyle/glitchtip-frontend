import { computed, Injectable, inject } from "@angular/core";
import { OrganizationsService } from "src/app/api/organizations.service";
import { components } from "src/app/api/api-schema";
import { client, handleError } from "src/app/shared/api/api";
import { apiResource } from "src/app/shared/api/api-resource-factory";

export type OrganizationSocialApp =
  components["schemas"]["OrganizationSocialAppSchema"];
export type OrganizationSocialAppPayload =
  components["schemas"]["OrganizationSocialAppUpdateIn"];

export interface SocialAppMutationResult {
  success: boolean;
  /** Server rejected because the org's plan does not include custom SSO */
  planLimited?: boolean;
  error?: string;
}

@Injectable({ providedIn: "root" })
export class OrganizationSocialAppsService {
  private organizationsService = inject(OrganizationsService);

  socialAppsResource = apiResource(
    this.organizationsService.activeOrganizationSlug,
    (slug) => ({
      url: "/api/0/organizations/{organization_slug}/social-apps/",
      options: { params: { path: { organization_slug: slug } } },
    }),
  );
  socialApps = computed(() => this.socialAppsResource.value() ?? []);

  async createSocialApp(
    payload: OrganizationSocialAppPayload,
  ): Promise<SocialAppMutationResult> {
    const { data, error, response } = await client.POST(
      "/api/0/organizations/{organization_slug}/social-apps/",
      {
        params: {
          path: {
            organization_slug:
              this.organizationsService.activeOrganizationSlug(),
          },
        },
        body: { ...payload, clientSecret: payload.clientSecret! },
      },
    );
    if (data) {
      this.socialAppsResource.reload();
      return { success: true };
    }
    return this.mutationError(error, response);
  }

  async updateSocialApp(
    id: number,
    payload: OrganizationSocialAppPayload,
  ): Promise<SocialAppMutationResult> {
    const { data, error, response } = await client.PUT(
      "/api/0/organizations/{organization_slug}/social-apps/{social_app_id}/",
      {
        params: {
          path: {
            organization_slug:
              this.organizationsService.activeOrganizationSlug(),
            social_app_id: id,
          },
        },
        body: payload,
      },
    );
    if (data) {
      this.socialAppsResource.reload();
      return { success: true };
    }
    return this.mutationError(error, response);
  }

  async deleteSocialApp(id: number): Promise<SocialAppMutationResult> {
    const { error, response } = await client.DELETE(
      "/api/0/organizations/{organization_slug}/social-apps/{social_app_id}/",
      {
        params: {
          path: {
            organization_slug:
              this.organizationsService.activeOrganizationSlug(),
            social_app_id: id,
          },
        },
      },
    );
    if (response.status === 204) {
      this.socialAppsResource.reload();
      return { success: true };
    }
    return this.mutationError(error, response);
  }

  private mutationError(
    error: unknown,
    response: Response,
  ): SocialAppMutationResult {
    const errors = handleError(error, response);
    const message = errors.detail.length ? errors.detail[0].msg : undefined;
    if (response.status === 403) {
      if (message?.toLowerCase().includes("plan")) {
        return { success: false, planLimited: true, error: message };
      }
      return {
        success: false,
        error: $localize`Only users with a role of manager or above can manage SSO.`,
      };
    }
    return {
      success: false,
      error: message ?? $localize`Something went wrong. Please try again.`,
    };
  }
}
