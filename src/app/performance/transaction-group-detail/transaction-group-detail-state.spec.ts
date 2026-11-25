import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import { OrganizationsService } from "src/app/api/organizations.service";
import { client } from "src/app/shared/api/api";
import { TransactionGroupDetailService } from "./transaction-group-detail-state";

const detailPath =
  "/api/0/organizations/{organization_id_or_slug}/transaction-groups/{id}/";
const spansPath =
  "/api/0/organizations/{organization_id_or_slug}/transaction-groups/{id}/spans/";

describe("TransactionGroupDetailService", () => {
  let service: TransactionGroupDetailService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TransactionGroupDetailService,
        {
          provide: OrganizationsService,
          useValue: {
            orgPath: (slug: string) => ({ organization_id_or_slug: slug }),
          },
        },
      ],
    });
    vi.spyOn(client, "GET").mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 404 }),
    });
    service = TestBed.inject(TransactionGroupDetailService);
  });

  afterEach(() => vi.restoreAllMocks());

  it("does not request data until route parameters are available", () => {
    TestBed.tick();
    expect(client.GET).not.toHaveBeenCalled();
  });

  it.each([
    ["now-1h", undefined],
    ["2026-10-01T00:00:00Z", "2026-10-02T00:00:00Z"],
  ])("forwards the time window to spans (%s, %s)", (start, end) => {
    service.setParams("acme", 42, start, end);
    TestBed.tick();
    expect(client.GET).toHaveBeenCalledWith(spansPath, {
      params: {
        path: { organization_id_or_slug: "acme", id: 42 },
        query: { start, end },
      },
    });
  });

  it("removes a previous time window when the filter is cleared", () => {
    service.setParams("acme", 42, "now-1h");
    TestBed.tick();
    vi.mocked(client.GET).mockClear();
    service.setParams("acme", 42);
    TestBed.tick();
    expect(client.GET).toHaveBeenCalledWith(spansPath, {
      params: {
        path: { organization_id_or_slug: "acme", id: 42 },
        query: { start: undefined, end: undefined },
      },
    });
  });

  it("keeps a missing group distinct from a group still loading", async () => {
    service.setParams("acme", 42);
    TestBed.tick();
    await vi.waitFor(() => expect(service.transactionGroup()).toBeNull());
    expect(service.initialLoadComplete()).toBe(true);
    expect(client.GET).toHaveBeenCalledWith(detailPath, {
      params: { path: { organization_id_or_slug: "acme", id: 42 } },
    });
  });
});
