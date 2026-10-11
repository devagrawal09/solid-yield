/**
 * D-122: `Ctx.provide({ init, children })`, the native lowering of a provider
 * whose value creates, cleans up or may fail (Effect's `createRuntime`). Solid
 * computes a provider's value once, in the provider's own owner: `init` runs
 * there, once; what it registers is cleaned up when the provider is disposed;
 * what it raises reaches the `Errored` above the provider.
 */
import { flush } from "solid-js";
import { component, $cleanup, createContext, Errored, raise, render, view } from "solid-yield";
import { Failed } from "./failed.js";

const Runtime = createContext<{ id: number } | null>(null);

function setup(fail: boolean) {
  const log: string[] = [];
  let made = 0;
  const init = function* () {
    const runtime = { id: ++made };
    log.push(`init ${runtime.id}`);
    yield* $cleanup(() => log.push(`dispose ${runtime.id}`));
    if (fail) yield* raise(new Failed("no runtime"));
    return runtime;
  };
  const Reader = component(function* Reader() {
    const runtime = yield* Runtime;
    return view(function* () {
      return <p class="reader">{String((yield* runtime)?.id)}</p>;
    });
  });
  const App = component(function* App() {
    return view(function* () {
      return (
        <>
          {
            yield* Errored({
              fallback: (err: () => Failed) => <p class="failed">{err().message}</p>,
              children: function* () {
                return (
                  <>
                    {
                      yield* Runtime.provide({
                        init,
                        children: function* () {
                          return <>{yield* Reader({})}</>;
                        }
                      })
                    }
                  </>
                );
              }
            })
          }
        </>
      );
    });
  });
  return { App, log };
}

describe("a provider's init (D-122)", () => {
  it("runs once, in the provider's owner: its value is provided, its cleanup runs at disposal", () => {
    const { App, log } = setup(false);
    const root = document.createElement("div");
    const dispose = render(() => App(), root);
    flush();
    expect(root.querySelector(".reader")?.textContent).toBe("1");
    expect(log).toEqual(["init 1"]);
    dispose();
    expect(log).toEqual(["init 1", "dispose 1"]);
  });

  it("a failure it raises reaches the Errored above the provider", () => {
    const { App, log } = setup(true);
    const root = document.createElement("div");
    const dispose = render(() => App(), root);
    flush();
    expect(root.querySelector(".failed")?.textContent).toBe("no runtime");
    expect(root.querySelector(".reader")).toBe(null);
    expect(log[0]).toBe("init 1");
    dispose();
  });
});
