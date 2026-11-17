import type {} from "@angular/localize/init";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApplicationRef, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { client } from "src/app/shared/api/api";
import { OrganizationsService } from "src/app/api/organizations.service";
import { IssueDetailService } from "./issue-detail.service";

const ana = { type: "user" as const, id: "2", name: "Ana" };
const platform = {
  type: "team" as const,
  id: "9",
  name: "platform",
  slug: "platform",
};

async function loadIssue(put: unknown) {
  vi.spyOn(client, "GET").mockResolvedValue({
    data: { id: "1", assignedTo: ana },
    response: new Response(null, { status: 200 }),
  } as never);
  const putSpy = vi.spyOn(client, "PUT").mockResolvedValue(put as never);
  const snackBar = { open: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: MatSnackBar, useValue: snackBar },
      {
        provide: OrganizationsService,
        useValue: {
          activeOrganizationSlug: signal("acme"),
          orgPath: (slug: string) => ({ organization_id_or_slug: slug }),
        },
      },
    ],
  });
  const service = TestBed.inject(IssueDetailService);
  service.issueID.set("1");
  await TestBed.inject(ApplicationRef).whenStable();
  return { service, putSpy, snackBar };
}

describe("IssueDetailService.setAssignee", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it("sends the picked value and keeps the saved assignee", async () => {
    const { service, putSpy } = await loadIssue({
      data: { assignedTo: platform },
    });
    await service.setAssignee({ value: "team:platform", actor: platform });
    expect(putSpy.mock.calls[0][1]).toMatchObject({
      body: { assignedTo: "team:platform" },
    });
    expect(service.issue()?.assignedTo).toEqual(platform);
  });

  it("ignores a reply that arrives after moving to another issue", async () => {
    let reply!: (value: unknown) => void;
    const { service } = await loadIssue(undefined);
    vi.mocked(client.PUT).mockReturnValue(
      new Promise((resolve) => (reply = resolve)) as never,
    );
    const pending = service.setAssignee({
      value: "team:platform",
      actor: platform,
    });
    service.issueID.set("2");
    await TestBed.inject(ApplicationRef).whenStable();
    reply({ data: { assignedTo: platform } });
    await pending;
    expect(service.issue()?.assignedTo).toEqual(ana);
  });

  it("puts the previous assignee back when the backend refuses", async () => {
    const { service, snackBar } = await loadIssue({
      error: { detail: "Team not found" },
    });
    await service.setAssignee({ value: "team:platform", actor: platform });
    expect(service.issue()?.assignedTo).toEqual(ana);
    expect(snackBar.open).toHaveBeenCalled();
  });
});
