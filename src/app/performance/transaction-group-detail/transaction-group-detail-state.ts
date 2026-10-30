import { computed, inject, Injectable, resource, signal } from "@angular/core";
import { OrganizationsService } from "src/app/api/organizations.service";
import { client } from "src/app/shared/api/api";

interface DetailParams {
  orgSlug: string;
  id: number;
  start?: string;
  end?: string;
}

@Injectable()
export class TransactionGroupDetailService {
  private organizationsService = inject(OrganizationsService);
  #params = signal<DetailParams | undefined>(undefined);
  #transactionGroupResource = resource({
    params: () => {
      const p = this.#params();
      return p ? { orgSlug: p.orgSlug, id: p.id } : undefined;
    },
    loader: async ({ params }) => {
      if (!params.params) {
        return undefined;
      }
      const { data } = await client.GET(
        "/api/0/organizations/{organization_id_or_slug}/transaction-groups/{id}/",
        {
          params: {
            path: {
              ...this.organizationsService.orgPath(params.params.orgSlug),
              id: params.params.id,
            },
          },
        },
      );
      return data;
    },
  });

  #spansResource = resource({
    params: () => ({ params: this.#params() }),
    loader: async ({ params }) => {
      if (!params.params) {
        return undefined;
      }
      const { data } = await client.GET(
        "/api/0/organizations/{organization_id_or_slug}/transaction-groups/{id}/spans/",
        {
          params: {
            path: {
              ...this.organizationsService.orgPath(params.params.orgSlug),
              id: params.params.id,
            },
            query: {
              start: params.params.start,
              end: params.params.end,
            },
          },
        },
      );
      return data;
    },
  });

  setParams(orgSlug: string, id: number, start?: string, end?: string) {
    this.#params.set({ orgSlug, id, start, end });
  }
  transactionGroup = computed(() => this.#transactionGroupResource.value());
  loading = computed(() => this.#transactionGroupResource.isLoading());
  initialLoadComplete = computed(
    () =>
      this.#transactionGroupResource.hasValue() ||
      !this.#transactionGroupResource.isLoading(),
  );
  spans = computed(() => this.#spansResource.value());
  spansLoading = computed(() => this.#spansResource.isLoading());
}
