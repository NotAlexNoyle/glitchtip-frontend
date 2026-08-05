import { computed, inject, Injectable, signal } from "@angular/core";
import { client } from "../shared/api/api";
import { AuthService } from "../auth.service";
import { apiResource } from "../shared/api/api-resource-factory";
import { Scope } from "../constants";

@Injectable({
  providedIn: "root",
})
export class OrganizationsService {
  authService = inject(AuthService);

  #activeOrganizationSlug = signal<string | null>(null);
  activeOrganizationSlug = computed(
    () =>
      this.#activeOrganizationSlug() ?? this.organizations()?.[0]?.slug ?? null,
  );
  /**
   * The org slug explicitly set from the route / org switcher, WITHOUT the
   * "default to the first org" fallback that activeOrganizationSlug applies. Use
   * this to key data fetches that must target the org the user is actually
   * viewing: keying on the fallback can fetch the first org's data during the
   * brief window before the route resolves (wrong-org fetch / "loads both orgs").
   */
  readonly selectedOrganizationSlug = this.#activeOrganizationSlug.asReadonly();
  organizationsResource = apiResource.fetchAll(
    this.authService.isAuthenticated,
    () => ({
      url: "/api/0/organizations/",
    }),
  );

  activeOrganizationResource = apiResource(
    this.activeOrganizationSlug,
    (slug) => ({
      url: "/api/0/organizations/{organization_slug}/",
      options: {
        params: {
          path: { organization_slug: slug },
        },
      },
    }),
  );
  organizations = computed(() => this.organizationsResource.value() || []);
  organizationsCount = computed(() => this.organizations.length);
  activeOrganization = computed(() => this.activeOrganizationResource.value());
  organizationsLoaded = computed(
    () =>
      this.organizationsResource.hasValue() ||
      !this.organizationsResource.isLoading(),
  );
  activeOrganizationLoaded = computed(
    () =>
      this.activeOrganizationResource.hasValue() ||
      !this.activeOrganizationResource.isLoading(),
  );
  activeOrganizationProjects = computed(
    () => this.activeOrganization()?.projects || [],
  );
  projectsCount = computed(() => this.activeOrganizationProjects().length);
  initialLoad = computed(
    () => this.organizationsLoaded() && this.activeOrganizationLoaded(),
  );
  /**
   * Scopes for the org actually being viewed. Fails closed to [] until the
   * loaded detail matches selectedOrganizationSlug: activeOrganization can
   * briefly hold the first-org fallback, gating buttons on the wrong org's role.
   */
  access = computed<ReadonlySet<Scope>>(() => {
    const selectedSlug = this.selectedOrganizationSlug();
    const organization = this.activeOrganization();
    if (!organization || organization.slug !== selectedSlug) {
      return new Set();
    }
    return new Set(organization.access);
  });

  /**
   * True when the user holds ANY of `required`, matching the any-of semantics of
   * the backend's @has_permission decorator. Call once per gate and store the
   * signal — calling it inside a template allocates a computed every check.
   */
  hasScope = (...required: Scope[]) =>
    computed(() => required.some((scope) => this.access().has(scope)));

  // Each list mirrors the @has_permission list on the endpoint the gated button
  // calls; update them together when a decorator changes.
  /**
   * create_project, update_project, create/update/test_project_alert. Also gates
   * Delete Project and Remove Alert, which require project:admin — a looser gate
   * than those two endpoints, harmless only while ROLES grants both to admin.
   */
  accessProjectWrite = this.hasScope("project:write", "project:admin");
  /** create_team */
  accessTeamWrite = this.hasScope(
    "team:write",
    "team:admin",
    "org:write",
    "org:admin",
  );
  /** create_organization_member */
  accessMemberWrite = this.hasScope("member:write", "member:admin");
  /** delete_organization */
  accessOrgAdmin = this.hasScope("org:admin");

  constructor() {
    setTimeout(() => this.refresh(), 30000);
  }

  setActiveOrganizationSlug(slug: string | null) {
    this.#activeOrganizationSlug.set(slug);
  }

  refreshActiveOrganization() {
    return this.activeOrganizationResource.reload();
  }

  reload() {
    this.organizationsResource.reload();
    this.activeOrganizationResource.reload();
  }

  async createOrganization(name: string) {
    const { data, error } = await client.POST("/api/0/organizations/", {
      body: { name },
    });
    if (data) {
      this.organizationsResource.update((orgs) =>
        orgs ? [...orgs, data] : [data],
      );
    }
    return { data, error };
  }

  /**
   * Silently attempt to refresh active org details every 2 seconds
   * until event rate throttle is 0 or 12 seconds passes.
   */
  repeatRefreshOrgDetail(i = 0) {
    this.activeOrganizationResource.reload();
    const org = this.activeOrganization();
    if (
      i < 10 &&
      (org?.eventThrottleRate === undefined || org.eventThrottleRate > 0)
    ) {
      setTimeout(() => this.repeatRefreshOrgDetail(i + 1), 2000);
    }
  }

  private refresh() {
    this.activeOrganizationResource.reload();
    this.organizationsResource.reload();
    setTimeout(() => this.refresh(), 10 * 60 * 1000); // 10 min
  }
}
