import { describe, expect, it } from "vitest";
import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { AnnotatedRequest } from "src/app/issues/interfaces";
import { IssueDetailService } from "../../issue-detail.service";
import { EntryRequestComponent } from "./entry-request.component";

// Typed loosely: payloads do not have to match the interface.
function render(request: object) {
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

  it("summarises each section and counts its rows by the label", () => {
    const fixture = render({
      url: "https://shop.example.com/cart",
      headers: [
        ["Accept", "*/*"],
        ["Accept", "text/html"],
      ],
      data: [{ sku: "A-1" }, { sku: "B-7" }],
    });
    const rows = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll(
        "button.gt-kv__row",
      ),
    ].map((b) =>
      [...b.children]
        .map((c) => c.textContent!.replace(/\s+/g, " ").trim())
        .join(" "),
    );
    expect(rows).toEqual([
      "Body [2] keyboard_arrow_right",
      "Headers 2 Accept */* · Accept text/html keyboard_arrow_right",
    ]);
  });

  it("is hidden when the request has no URL and no sections", () => {
    const fixture = render({ method: "GET", url: null, data: "", query: [] });
    expect((fixture.nativeElement as HTMLElement).textContent).toBe("");
  });
});
