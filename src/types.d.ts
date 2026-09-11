interface Window {
  plausible?: any;
  Cypress?: unknown;
}

// Provided at runtime by the `@angular/localize/init` polyfill in the build
// target. The unit-test builder compiles specs without that polyfill, so the
// global needs a declaration for type-checking to succeed there too.
declare const $localize: (
  messageParts: TemplateStringsArray,
  ...expressions: readonly any[]
) => string;
