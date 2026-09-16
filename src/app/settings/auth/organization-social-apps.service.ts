import { computed, Injectable, signal } from "@angular/core";
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
  // Keyed on a page-set signal rather than the live active-org signal, so
  // this root service doesn't refetch (403 for plain members) on every org
  // switch after the page has been visited once. The page keeps it in sync
  // while mounted; see TeamsService for the same pattern. Mutations read the
  // same signal, so a write always targets the org the page is showing.
  private orgSlug = signal<string | null>(null);
  socialAppsResource = apiResource(this.orgSlug, (slug) => ({
    url: "/api/0/organizations/{organization_slug}/social-apps/",
    options: { params: { path: { organization_slug: slug } } },
  }));
  socialApps = computed(() => this.socialAppsResource.value() ?? []);

  setOrganization(slug: string) {
    this.orgSlug.set(slug);
  }

  async createSocialApp(
    payload: components["schemas"]["OrganizationSocialAppIn"],
  ): Promise<SocialAppMutationResult> {
    const slug = this.orgSlug();
    if (!slug) {
      return this.noOrganization();
    }
    const { data, error, response } = await client.POST(
      "/api/0/organizations/{organization_slug}/social-apps/",
      {
        params: { path: { organization_slug: slug } },
        body: payload,
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
    const slug = this.orgSlug();
    if (!slug) {
      return this.noOrganization();
    }
    const { data, error, response } = await client.PUT(
      "/api/0/organizations/{organization_slug}/social-apps/{social_app_id}/",
      {
        params: { path: { organization_slug: slug, social_app_id: id } },
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
    const slug = this.orgSlug();
    if (!slug) {
      return this.noOrganization();
    }
    const { error, response } = await client.DELETE(
      "/api/0/organizations/{organization_slug}/social-apps/{social_app_id}/",
      {
        params: { path: { organization_slug: slug, social_app_id: id } },
      },
    );
    if (response.status === 204) {
      this.socialAppsResource.reload();
      return { success: true };
    }
    return this.mutationError(error, response);
  }

  private noOrganization(): SocialAppMutationResult {
    return {
      success: false,
      error: $localize`Something went wrong. Please try again.`,
    };
  }

  /**
   * django-ninja answers HttpError with `{"detail": "<message>"}` -- a string,
   * not the `[{msg}]` list handleError() normalizes 400 and 422 into.
   */
  private ninjaDetail(error: unknown): string | undefined {
    if (error && typeof error === "object" && "detail" in error) {
      const detail = (error as { detail: unknown }).detail;
      if (typeof detail === "string") {
        return detail;
      }
    }
    return undefined;
  }

  private mutationError(
    error: unknown,
    response: Response,
  ): SocialAppMutationResult {
    if (response.status === 403) {
      // handleError() has no 403 branch, so it flattens every one of these to
      // "Something went wrong" -- read the body directly instead. Three 403s
      // reach here and only the plan limit is actionable from this page:
      // "forbidden" (below manager), "Permission denied" (token scope), and
      // the plan message. Anything unrecognized is shown as the server wrote
      // it rather than reported as a permission problem it may not be.
      const message = this.ninjaDetail(error);
      if (message?.toLowerCase().includes("plan")) {
        return { success: false, planLimited: true, error: message };
      }
      if (message === "forbidden" || message === "Permission denied") {
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
    const errors = handleError(error, response);
    const message = errors.detail.length ? errors.detail[0].msg : undefined;
    return {
      success: false,
      error: message ?? $localize`Something went wrong. Please try again.`,
    };
  }
}
