import { Directive, ElementRef, afterNextRender, inject } from "@angular/core";

/** Adds `is-loading` until its images decode; never set without JS or when cached. */
@Directive({
  selector: "[mktImagesReady]",
})
export class ImagesReadyDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    afterNextRender(() => {
      const node = this.host.nativeElement;
      const pending = [...node.querySelectorAll("img")].filter(
        (img) => !img.complete,
      );
      if (!pending.length) {
        return;
      }
      node.classList.add("is-loading");
      // decode() resolves once the pixels are ready to paint; a failed image
      // still releases the hold.
      Promise.allSettled(pending.map((img) => img.decode())).then(() =>
        node.classList.remove("is-loading"),
      );
    });
  }
}
