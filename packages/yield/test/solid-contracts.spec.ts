/** F15: disposed-owner reports are outside Solid's delivery guarantee. */
import {
  createRenderEffect,
  getOwner,
  runWithOwner,
  flush,
  resetErrorHalt,
  Errored
} from "solid-js";
import { render } from "@solidjs/web";
declare const __DEV__: boolean;
it("a report computation under a disposed captured owner does not reach its old boundary", () => {
  let owner: ReturnType<typeof getOwner>;
  let fallbacks = 0;
  const root = document.createElement("div");
  const dispose = render(
    () =>
      Errored({
        fallback: () => {
          fallbacks++;
          return "caught";
        },
        get children() {
          owner = getOwner();
          return "child";
        }
      }),
    root
  );
  flush();
  dispose();
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    runWithOwner(owner!, () => {
      createRenderEffect(
        () => {
          throw new Error("late");
        },
        () => {}
      );
    });
    flush();
    expect(fallbacks).toBe(0);
    const log = [...warnings.mock.calls, ...errors.mock.calls].flat().map(String).join("\n");
    if (__DEV__) expect(log).toContain("[RUN_WITH_DISPOSED_OWNER]");
  } finally {
    warnings.mockRestore();
    errors.mockRestore();
    resetErrorHalt();
  }
});
