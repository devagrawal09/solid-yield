import { resetErrorHalt } from "solid-js";
import { component, hydrate, lazy, Loading, view } from "solid-yield";

import { h } from "solid-yield/h";

declare const __DEV__: boolean;
it("a missing hydration chunk is infrastructure, not an untyped user throw", async () => {
  const Page = component(function* Page() {
    return view(function* () {
      return <p>page</p>;
    });
  });
  const LazyPage = lazy(() => Promise.resolve({ default: Page }), {}, "src/review-page.tsx");
  const App = component(function* App() {
    return view(function* () {
      return h(LazyPage, {});
    });
  });
  const root = document.createElement("div");
  (globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    let failure: unknown;
    try {
      hydrate(() => Loading({ children: App }), root);
    } catch (e) {
      failure = e;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toContain(
      __DEV__ ? "[LAZY_HYDRATION_PRELOAD]" : "was not preloaded before hydration"
    );
    expect((failure as Error).message).not.toContain("[UNTYPED_THROW]");
    if (__DEV__) expect((failure as Error).cause).toBeInstanceOf(Error);
  } finally {
    await Promise.resolve();
    delete (globalThis as any)._$HY;
    errors.mockRestore();
    warnings.mockRestore();
    resetErrorHalt();
  }
});
