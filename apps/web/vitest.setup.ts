import "@testing-library/jest-dom/vitest";

// jsdom does not implement the native <dialog> element's showModal/close/open
// behaviour (confirmed: it falls back to HTMLUnknownElement for <dialog>) --
// this is a test-environment gap, not a component defect. Minimal polyfill so
// components using the real native <dialog> API (e.g. ConfirmationDialog) are
// testable; real browsers already implement this natively.
if (typeof HTMLElement !== "undefined" && !("showModal" in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, "open", {
    get(this: HTMLElement) {
      return this.hasAttribute("open");
    },
    set(this: HTMLElement, value: boolean) {
      if (value) this.setAttribute("open", "");
      else this.removeAttribute("open");
    },
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, "showModal", {
    value(this: HTMLElement) {
      this.setAttribute("open", "");
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(HTMLElement.prototype, "close", {
    value(this: HTMLElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    },
    writable: true,
    configurable: true,
  });
}
