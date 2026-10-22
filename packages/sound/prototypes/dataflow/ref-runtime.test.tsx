// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
import { createSignal, flush, getObserver } from "solid-js";
import { render } from "@solidjs/web";

it("a ref read-modify-write runs once without a tracking observer", () => {
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  let runs = 0;
  let observer: unknown;
  let update: (() => void) | undefined;
  function App() {
    const [n, set] = createSignal(1);
    update = () => set(2);
    return <div ref={el => {
      runs++; observer = getObserver();
      set(n() + el.childElementCount);
    }}>{n()}</div>;
  }
  const dispose = render(App, document.body);
  try {
    flush();
    expect(runs).toBe(1);
    expect(observer == null).toBe(true);
    update?.(); flush();
    expect(runs).toBe(1);
    expect(document.body.textContent).toBe("2");
    // rc.17 intentionally untracks refs, so this read emits no runtime warning.
    // D-131 nevertheless requires the static setup-like read finding.
    expect(warnings).not.toHaveBeenCalled();
  } finally {
    dispose(); document.body.replaceChildren(); warnings.mockRestore();
  }
});
