import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { AnnotatedRequest } from "src/app/issues/interfaces";
import { IssueDetailService } from "../../issue-detail.service";
import { EntryRequestComponent } from "./entry-request.component";

describe("EntryRequestComponent", () => {
  // The request interface does not require a URL, and the API sends null.
  it("renders a request without a URL", () => {
    const request = {
      method: "POST",
      url: null,
      path: "",
      headers: [["Content-Type", "application/json"]],
      inferredContentType: "application/json",
    } as AnnotatedRequest;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: IssueDetailService,
          useValue: { eventEntryRequest: signal(request) },
        },
      ],
    });
    const fixture = TestBed.createComponent(EntryRequestComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("Headers");
    expect(el.textContent).not.toContain("URL");

    fixture.componentInstance.format.set("raw");
    fixture.detectChanges();
    expect(el.querySelector("pre")!.textContent).toMatch(/^POST\n/);
  });
});
