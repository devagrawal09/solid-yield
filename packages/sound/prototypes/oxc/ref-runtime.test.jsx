// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { createSignal, getObserver, flush } from "solid-js";
import { render } from "@solidjs/web";

it("a ref that reads and writes a signal still takes an untracked snapshot", () => {
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  const [value, setValue] = createSignal(1);
  let runs = 0;
  let observer;
  let snapshot;
  const dispose = render(
    () => (
      <div
        ref={element => {
          runs++;
          observer = getObserver();
          snapshot = value();
          setValue(snapshot + element.childElementCount);
        }}
      >
        {value()}
      </div>
    ),
    document.body
  );
  try {
    flush();
    setValue(4);
    flush();
    expect(runs).toBe(1);
    expect(observer == null).toBe(true);
    expect(snapshot).toBe(1);
    expect(document.body.textContent).toBe("4");
  } finally {
    dispose();
    document.body.replaceChildren();
    warning.mockRestore();
  }
});
