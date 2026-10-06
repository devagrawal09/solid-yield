/**
 * Runtime evidence for λ-yield's proof obligations (`documentation/calculus.md`
 * §5): one `describe` per obligation that had no runtime test. Each test pins
 * the route the runtime takes today; where that contradicts the rule, the
 * test says so and the calculus records a finding. Views are written in the
 * form the JSX transform's yield rule produces (`perform(x)` for `yield* x`),
 * as in runtime.spec.
 */
import { flush } from "solid-js";
import {
  component,
  $memo,
  attempt,
  createContext,
  Errored,
  Loading,
  perform,
  raise,
  render,
  view,
  type Reset,
  type Path
} from "solid-yield";
import { h } from "solid-yield/h";
import { toFailed } from "./failed.js";

declare const __DEV__: boolean;

const tick = () => new Promise<void>(r => setTimeout(r, 0));
async function settle(times = 3) {
  for (let i = 0; i < times; i++) {
    await tick();
    flush();
  }
}

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
});
function mount(App: () => any) {
  dispose = render(App as any, root);
  flush();
}

class Boom extends Error {
  readonly kind = "boom" as const;
}
class Other extends Error {
  readonly kind = "other" as const;
}

/** A component whose view reads a memo that raises `e`. */
function failing(make: () => Boom | Other) {
  return component(function* Failing() {
    const m = yield* $memo(function* () {
      return yield* raise(make());
    });
    return view(function* () {
      return <i>{perform(m)}</i>;
    });
  });
}

// --- O28 / O29: an Errored's fallback's own colors pass above it (D-071, F-1) ------------------
describe("O28 / O29: an Errored's fallback's own failure reaches the Errored above it", () => {
  const ChildFails = failing(() => new Boom("child"));
  const FallbackFails = failing(() => new Other("fallback"));

  /** An inner Errored whose children fail with Boom and whose fallback fails with Other. */
  function nested(fallback: any) {
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return (
            <>
              {perform(
                Errored({
                  fallback,
                  children: function* () {
                    return <>{perform(ChildFails())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
  }

  it("a lazy-view fallback (O28)", () => {
    nested(function* () {
      return <>{perform(FallbackFails())}</>;
    });
    expect(root.textContent).toBe("outer: fallback");
  });

  it("a row fallback (error, reset) (O28)", () => {
    nested(function* (_err: Path<Boom>, _reset: Reset) {
      return view(function* () {
        return <>{perform(FallbackFails())}</>;
      });
    });
    expect(root.textContent).toBe("outer: fallback");
  });

  it("a render-function fallback (error, reset) => view (O29)", () => {
    nested((_e: any, _r: any) => FallbackFails());
    expect(root.textContent).toBe("outer: fallback");
  });

  it("an h-output fallback (O29)", () => {
    nested(h(FallbackFails, {}));
    expect(root.textContent).toBe("outer: fallback");
  });

  it("with catch: the fallback's own failure is not this boundary's either", () => {
    mount(() =>
      Errored({
        fallback: (e: any) => <p>outer: {e().message}</p>,
        children: function* () {
          return (
            <>
              {perform(
                Errored({
                  catch: [Boom],
                  fallback: (_e: any, _r: any) => FallbackFails(),
                  children: function* () {
                    return <>{perform(ChildFails())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
    expect(root.textContent).toBe("outer: fallback");
  });

  it("an h-output fallback's pending read reaches the Loading above (O29)", async () => {
    let resolve!: (v: string) => void;
    const Pends = component(function* Pends() {
      const v = yield* $memo(function* () {
        return yield* attempt(() => new Promise<string>(r => (resolve = r)), toFailed);
      });
      return view(function* () {
        return <b>{perform(v)}</b>;
      });
    });
    mount(() =>
      Loading({
        fallback: "loading",
        children: function* () {
          return (
            <>
              {perform(
                Errored({
                  fallback: h(Pends, {}),
                  children: function* () {
                    return <>{perform(ChildFails())}</>;
                  }
                })
              )}
            </>
          );
        }
      })
    );
    expect(root.textContent).toBe("loading");
    resolve("shown");
    await settle();
    expect(root.textContent).toBe("shown");
  });
});

// --- O34: a provided value is never unset (F-3, S11) --------------------------------------------
describe("O34: provide's value is never undefined; nothing is modelled inside the value", () => {
  const MaybeUser = createContext<{ name: string } | null | undefined, "MaybeUser">();
  const Who = component(function* Who() {
    const user = yield* MaybeUser;
    return view(function* () {
      return <b>{perform(user)?.name ?? "nobody"}</b>;
    });
  });
  const app = (value: any) => () =>
    MaybeUser.provide({
      value,
      children: function* () {
        return <>{perform(Who())}</>;
      }
    });

  it("provide({ value: null }) gives null: the reader sees nothing, not a missing provider", () => {
    mount(app(null));
    expect(root.textContent).toBe("nobody");
  });

  it("provide({ value: undefined }) is refused by the type; the runtime reads it as no provider", () => {
    // never called: the type's half
    void (() =>
      // @ts-expect-error [PROVIDE_UNDEFINED] a provided undefined reads as no provider
      MaybeUser.provide({ value: undefined, children: "x" }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => mount(app(undefined))).toThrow(__DEV__ ? "[NO_PROVIDER]" : /context/i);
    } finally {
      error.mockRestore();
    }
  });
});
