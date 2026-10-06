/** F06 is pinned, not repaired by changing foreign's API. */
import { flush, resetErrorHalt } from "solid-js";
import {
  $memo,
  attempt,
  component,
  createContext,
  foreign,
  render,
  view,
  type View
} from "solid-yield";
import { h } from "solid-yield/h";
declare const __DEV__: boolean;
it("F06: a foreign provided claim is checked at the yield child's creation", () => {
  const C = createContext<string, "ForeignC">(undefined, { name: "ForeignC" });
  const Reader = component(function* Reader() {
    const c = yield* C;
    return view(function* () {
      return <b>{yield* c}</b>;
    });
  });
  const page = foreign(Reader, { provided: [C] });
  function Router() {
    return h(page, {});
  }
  const App = component(function* () {
    return view(function* () {
      return <Router />;
    });
  });
  const accepted: () => View<false, never, false, never> = App;
  const root = document.createElement("div");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(() => {
      render(accepted, root);
      flush();
    }).toThrow(__DEV__ ? /NO_PROVIDER.*Reader.*ForeignC/ : /context/i);
  } finally {
    errors.mockRestore();
    resetErrorHalt();
  }
});
it("F06 finding: foreign permits a pending read without ambient Loading, leaving empty output", () => {
  const Pending = component(function* () {
    const n = yield* $memo(function* () {
      return yield* attempt(
        () => new Promise<string>(() => {}),
        () => ""
      );
    });
    return view(function* () {
      return <b>{yield* n}</b>;
    });
  });
  const page = foreign(Pending);
  function Router() {
    return h(page, {});
  }
  const App = component(function* () {
    return view(function* () {
      return <Router />;
    });
  });
  const accepted: () => View<false, never, false, never> = App;
  const root = document.createElement("div");
  const dispose = render(accepted, root);
  try {
    flush();
    expect(root.textContent).toBe("");
    expect(root.querySelector("b")).toBeNull();
  } finally {
    dispose();
    resetErrorHalt();
  }
});
