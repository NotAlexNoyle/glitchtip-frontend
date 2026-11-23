// Type-only: declares the $localize global for the spec program.
import type {} from "@angular/localize/init";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { OrganizationsService } from "src/app/api/organizations.service";
import { client } from "src/app/shared/api/api";
import { AcceptInviteService } from "./accept-invite.service";

describe("AcceptInviteService.acceptInvite", () => {
  let service: AcceptInviteService;
  const snackBar = { open: vi.fn() };
  const router = { navigate: vi.fn() };

  function stubPost(status: number, error: unknown) {
    vi.spyOn(client, "POST").mockResolvedValue({
      data: undefined,
      error,
      response: new Response(null, { status }),
    } as unknown as Awaited<ReturnType<typeof client.POST>>);
  }

  beforeEach(() => {
    snackBar.open.mockReset();
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatSnackBar, useValue: snackBar },
        { provide: Router, useValue: router },
        {
          provide: OrganizationsService,
          useValue: { organizations: signal([]), reload: vi.fn() },
        },
      ],
    });
    service = TestBed.inject(AcceptInviteService);
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows the server's 403 detail", async () => {
    stubPost(403, { detail: "This invite has already been accepted" });
    await service.acceptInvite(1, "token");
    expect(snackBar.open).toHaveBeenCalledWith(
      "This invite has already been accepted",
    );
  });

  it("falls back to the invalid-link message without a usable detail", async () => {
    stubPost(404, { detail: "Not Found" });
    await service.acceptInvite(1, "token");
    expect(snackBar.open).toHaveBeenCalledWith(
      expect.stringContaining("expired or is invalid"),
    );
  });

  it("blames an existing membership on a 500", async () => {
    stubPost(500, "<html>Server Error</html>");
    await service.acceptInvite(1, "token");
    expect(snackBar.open).toHaveBeenCalledWith(
      expect.stringContaining("already a part of"),
    );
  });
});
