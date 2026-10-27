import { computed, inject, Injectable, resource, signal } from "@angular/core";
import { OrganizationsService } from "src/app/api/organizations.service";
import { client, handleError } from "src/app/shared/api/api";
import {
  getPaginationHeaders,
  getPaginator,
} from "src/app/shared/pagination.utils";
import { keepPreviousValue } from "src/app/shared/signal.utils";

@Injectable()
export class UserReportsService {
  private organizationsService = inject(OrganizationsService);
  orgSlug = signal("");
  issueID = signal("");
  cursor = signal("");
  #reportsResource = resource({
    params: () => ({
      orgSlug: this.orgSlug(),
      issueID: this.issueID(),
      cursor: this.cursor(),
    }),
    loader: async ({ params }) => {
      if (!params.issueID || !params.orgSlug) {
        return undefined;
      }
      const { data, response, error } = await client.GET(
        "/api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/user-reports/",
        {
          params: {
            path: {
              ...this.organizationsService.orgPath(params.orgSlug),
              issue_id: parseInt(params.issueID),
            },
          },
        },
      );
      if (!data) {
        return {
          data,
          pagination: undefined,
          errors: handleError(error, response),
        };
      }
      const pagination = getPaginationHeaders(response);
      return { data, pagination, errors: null };
    },
  });
  // Keep the last page visible during a reload so the list doesn't blank out.
  #reportsData = keepPreviousValue(() => this.#reportsResource.value()?.data);
  reports = computed(() => this.#reportsData() ?? []);
  errors = computed(() => this.#reportsResource.value()?.errors?.detail[0].msg);
  pagination = keepPreviousValue(
    () => this.#reportsResource.value()?.pagination,
  );
  paginator = computed(() => getPaginator(this.pagination()));
  loading = computed(() => this.#reportsResource.isLoading());

  setParams(orgSlug: string, issueID: string, cursor: string) {
    this.orgSlug.set(orgSlug);
    this.issueID.set(issueID);
    this.cursor.set(cursor);
  }
}
