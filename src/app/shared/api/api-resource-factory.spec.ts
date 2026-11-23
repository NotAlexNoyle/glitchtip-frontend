import { afterEach, describe, expect, it, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import { client } from "./api";
import { apiResource, FETCH_ALL_MAX_PAGES } from "./api-resource-factory";

/** One page of `size` rows, with a next link while more pages remain. */
function page(index: number, size: number, pages: number) {
  const next = `<http://x/api/0/projects/?cursor=c${index + 1}>; rel="next"; results="${index + 1 < pages}"; cursor="c${index + 1}"`;
  const previous = `<http://x/api/0/projects/?cursor=p>; rel="previous"; results="false"; cursor="p"`;
  return {
    data: Array.from({ length: size }, (_, i) => ({ id: index * size + i })),
    error: undefined,
    response: new Response(null, {
      headers: {
        link: `${previous}, ${next}`,
        "x-hits": String(pages * size),
        "x-max-hits": "1000",
      },
    }),
  };
}

describe("apiResource.fetchAll", () => {
  afterEach(() => vi.restoreAllMocks());

  it("follows the cursor past 500 rows until the last page", async () => {
    const pages = 7;
    let call = 0;
    const get = vi
      .spyOn(client, "GET")
      .mockImplementation(async () => page(call++, 100, pages) as never);

    const resource = TestBed.runInInjectionContext(() =>
      apiResource.fetchAll(() => ({ url: "/api/0/projects/" })),
    );
    await vi.waitFor(() => expect(resource.isLoading()).toBe(false));

    expect(get).toHaveBeenCalledTimes(pages);
    expect((resource.value() as unknown[]).length).toBe(700);
    expect(get.mock.calls[0][1]).toMatchObject({
      params: { query: { limit: 100, cursor: null } },
    });
    expect(get.mock.calls[1][1]).toMatchObject({
      params: { query: { cursor: "c1" } },
    });
  });

  it("stops at the page cap when the cursor never ends", async () => {
    let call = 0;
    const get = vi
      .spyOn(client, "GET")
      .mockImplementation(async () => page(call++, 1, Infinity) as never);

    const resource = TestBed.runInInjectionContext(() =>
      apiResource.fetchAll(() => ({ url: "/api/0/projects/" })),
    );
    await vi.waitFor(() => expect(resource.isLoading()).toBe(false));

    expect(get).toHaveBeenCalledTimes(FETCH_ALL_MAX_PAGES);
    expect((resource.value() as unknown[]).length).toBe(FETCH_ALL_MAX_PAGES);
  });
});
