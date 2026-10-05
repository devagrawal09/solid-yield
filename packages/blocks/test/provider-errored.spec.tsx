/**
 * A view whose root is a foreign component's tag — a context provider —
 * holding a call-form `Errored`, rendered under another `Errored` (D-085's
 * note). Solid's provider returns its `children` memo, so the view's output
 * is a function. `$component` did not mark it as a view, so `perform` in the
 * holding hole called it: the hole read what the provider shows, and when
 * the inner `Errored` switched to its fallback the hole re-ran and re-created
 * the component — its setup and its state — and the fallback never reached
 * the DOM. A wrapper element hid it (the view's output was a node). Not
 * Solid's: handwritten Solid in the same shape shows the fallback.
 */
import {
  createContext as solidContext,
  createSignal,
  Errored as SolidErrored,
  flush
} from "solid-js";
import { render as solidRender } from "@solidjs/web";
import {
  $component,
  $event,
  $memo,
  $signal,
  createContext,
  Errored,
  raise,
  render,
  view,
  type Reset
} from "solid-blocks";
import { Failed } from "./failed.js";

const tick = () => new Promise<void>(r => setTimeout(r, 0));

const TopLevel = createContext<number>(0);

/** App > Errored > Panel (provider tag at its view's root) > Child > Errored > failing hole. */
function app(Ctx: any, wrap: boolean) {
  let fail!: () => unknown;
  const log: string[] = [];
  const Child = $component(function* Child() {
    log.push("setup");
    const [bad, setBad] = yield* $signal(false);
    fail = $event(function* () {
      yield* setBad(true);
    });
    const value = yield* $memo(function* () {
      if (yield* bad) yield* raise(new Failed("boom"));
      return "ok";
    });
    return view(function* () {
      return (
        <>
          {
            yield* Errored({
              fallback: (err: () => Failed, _reset: Reset) => {
                log.push("inner " + err().message);
                return <p class="inner">{err().message}</p>;
              },
              children: function* () {
                return <p class="value">{yield* value}</p>;
              }
            })
          }
        </>
      );
    });
  });
  const Panel = $component(function* Panel() {
    return view(function* () {
      return wrap ? (
        <div class="panel">
          <Ctx value={1}>{yield* Child()}</Ctx>
        </div>
      ) : (
        <Ctx value={1}>{yield* Child()}</Ctx>
      );
    });
  });
  const App = $component(function* App() {
    return view(function* () {
      return (
        <main>
          {
            yield* Errored({
              fallback: (err: () => Failed) => {
                log.push("outer " + err().message);
                return <p class="outer">{err().message}</p>;
              },
              children: function* () {
                return <>{yield* Panel()}</>;
              }
            })
          }
        </main>
      );
    });
  });
  return { App, fail: () => fail(), log };
}

describe("a provider tag at a view's root holding a call-form Errored (D-085's note)", () => {
  const contexts = [
    ["a library context made at the module's top level", () => TopLevel],
    ["a library context made in the test", () => createContext<number>(0)],
    ["Solid's createContext", () => solidContext<number>(0)]
  ] as const;
  for (const [label, makeContext] of contexts) {
    for (const wrap of [false, true]) {
      it(`${label}, ${wrap ? "under a wrapper element" : "at the view's root"}: the inner Errored shows its fallback; the component is set up once`, async () => {
        const root = document.createElement("div");
        document.body.appendChild(root);
        const { App, fail, log } = app(makeContext(), wrap);
        const dispose = render(() => App(), root);
        flush();
        expect(root.querySelector(".value")?.textContent).toBe("ok");
        fail();
        flush();
        await tick();
        flush();
        expect(log).toEqual(["setup", "inner boom"]);
        expect(root.querySelector(".inner")?.textContent).toBe("boom");
        expect(root.querySelector(".value")).toBeNull();
        expect(root.querySelector(".outer")).toBeNull();
        dispose();
        root.remove();
      });
    }
  }

  it("handwritten Solid in the same shape shows the inner fallback (the reference)", async () => {
    const Ctx = solidContext<number>(0);
    const [bad, setBad] = createSignal(false);
    const log: string[] = [];
    function Child() {
      log.push("setup");
      const value = () => {
        if (bad()) throw new Error("boom");
        return "ok";
      };
      return (
        <SolidErrored
          fallback={(err: any) => {
            log.push("inner " + err().message);
            return <p class="inner">{err().message}</p>;
          }}
        >
          <p class="value">{value()}</p>
        </SolidErrored>
      );
    }
    function Panel() {
      return (
        <Ctx value={1}>
          <Child />
        </Ctx>
      );
    }
    function App() {
      return (
        <main>
          <SolidErrored fallback={(err: any) => <p class="outer">{err().message}</p>}>
            <Panel />
          </SolidErrored>
        </main>
      );
    }
    const root = document.createElement("div");
    const dispose = solidRender(() => <App />, root);
    flush();
    setBad(true);
    flush();
    await tick();
    flush();
    expect(log).toEqual(["setup", "inner boom"]);
    expect(root.querySelector(".inner")?.textContent).toBe("boom");
    dispose();
  });
});
