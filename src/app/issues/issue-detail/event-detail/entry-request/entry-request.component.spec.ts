import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { AnnotatedRequest } from "src/app/issues/interfaces";
import { IssueDetailService } from "../../issue-detail.service";
import { EntryRequestComponent } from "./entry-request.component";

function render(request: Partial<AnnotatedRequest>) {
  TestBed.configureTestingModule({
    providers: [
      {
        provide: IssueDetailService,
        useValue: {
          eventEntryRequest: signal({
            headers: [],
            inferredContentType: null,
            path: "",
            ...request,
          } as AnnotatedRequest),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(EntryRequestComponent);
  fixture.detectChanges();
  return fixture;
}

describe("EntryRequestComponent", () => {
  // The request interface does not require a URL, and the API sends null.
  it("renders a request without a URL", () => {
    const fixture = render({
      method: "POST",
      url: null,
      headers: [["Content-Type", "application/json"]],
      inferredContentType: "application/json",
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("Headers");
    expect(el.textContent).not.toContain("URL");

    fixture.componentInstance.format.set("raw");
    fixture.detectChanges();
    expect(el.querySelector("pre")!.textContent).toMatch(/^POST\n/);
  });

  // sentry-java and sentry-dotnet send cookies as the raw Cookie header.
  it("lists cookies sent as a header string, one row per cookie", () => {
    const fixture = render({
      url: "https://shop.example.com/cart",
      cookies: "sessionid=abc; theme=dark",
    });
    const el = fixture.nativeElement as HTMLElement;
    const toggle = [
      ...el.querySelectorAll<HTMLButtonElement>(".gt-kv__row"),
    ].find((b) => b.textContent?.includes("Cookies"))!;
    toggle.click();
    fixture.detectChanges();
    const keys = [...el.querySelectorAll(".gt-property-list dt")].map(
      (dt) => dt.textContent,
    );
    expect(keys).toEqual(["sessionid", "theme"]);

    fixture.componentInstance.format.set("raw");
    fixture.detectChanges();
    expect(el.querySelector("pre")!.textContent).toContain(
      "\nCookie: sessionid=abc; theme=dark",
    );
  });
});
