// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { createMemo, flush, Loading } from "solid-js";
import { render } from "@solidjs/web";

// The same component can be safely mounted by a caller's Loading boundary.
// Its export alone cannot prove that no such caller exists.
export function PendingSibling() {
  const read = createMemo(() => Promise.resolve("ready"));
  return (
    <>
      <Loading on="key" fallback={<p>inner wait</p>}>
        {null}
      </Loading>
      <p>{read()}</p>
    </>
  );
}
it("rc.17 lets the caller cover an exported component's pending sibling", async () => {
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  const dispose = render(
    () => (
      <Loading fallback={<p>outer wait</p>}>
        <PendingSibling />
      </Loading>
    ),
    document.body
  );
  try {
    flush();
    expect(document.body.textContent).toBe("outer wait");
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
      flush();
    }
    expect(document.body.textContent).toBe("ready");
    expect(warnings.mock.calls.flat().map(String).join(" ")).not.toContain(
      "ASYNC_OUTSIDE_LOADING_BOUNDARY"
    );
  } finally {
    dispose();
    document.body.replaceChildren();
    warnings.mockRestore();
  }
});
