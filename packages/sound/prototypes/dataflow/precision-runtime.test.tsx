// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createMemo, flush, Loading } from "solid-js";
import { render } from "@solidjs/web";

const disposals: (() => void)[] = [];
afterEach(() => {
  disposals.splice(0).forEach(dispose => dispose());
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

// Same view shape as the disputed frozen export; no fixture is edited.
export function PendingView() {
  const read = createMemo(() => Promise.resolve("ready"));
  return <><Loading on="key" fallback={<p>wait</p>}>{null}</Loading><p>{read()}</p></>;
}

it("an unrendered export has no runtime root obligation", () => {
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  flush();
  expect(typeof PendingView).toBe("function");
  expect(document.body.textContent).toBe("");
  expect(warnings).not.toHaveBeenCalled();
});

it("the renderer, not export syntax, determines whether the pending view is covered", async () => {
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  disposals.push(render(() => <Loading fallback={<p>covered</p>}><PendingView /></Loading>, document.body));
  flush();
  expect(warnings.mock.calls.flat().map(String).join(" ")).not.toContain("ASYNC_OUTSIDE_LOADING_BOUNDARY");
  for (let i = 0; i < 5; i++) { await Promise.resolve(); flush(); }
  expect(document.body.textContent).toBe("ready");
  disposals.splice(0).forEach(dispose => dispose());
  document.body.replaceChildren();
  warnings.mockClear();
  disposals.push(render(PendingView, document.body));
  flush();
  expect(warnings.mock.calls.flat().map(String).join(" ")).toContain("ASYNC_OUTSIDE_LOADING_BOUNDARY");
});
