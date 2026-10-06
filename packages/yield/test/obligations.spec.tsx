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
