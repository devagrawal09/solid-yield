/**
 * Native lowering runtime: a library setter in a plain function type
 * (`nativeWrite`, the dashboard's `setRange: (range: Range) => void`) writes
 * when called, where a write is admitted; a writing callback prop created in a
 * view (F-S40) runs in the event that calls it.
 */
import { flush } from "solid-js";
import {
  component,
  $event,
  $memo,
  $signal,
  Errored,
  Failure,
  raise,
  render,
  view,
  type Props
} from "solid-yield";
import { nativeWrite } from "../src/native-write.js";
import { nativeLexicalCallback } from "../src/native-control.js";

declare const __DEV__: boolean;
const devIt = __DEV__ ? it : it.skip;

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

describe("nativeWrite", () => {
  it("writes when an event calls the adapted setter", () => {
    const App = component(function* () {
      const [n, setN] = yield* $signal(0);
      const plain: (value: number) => void = nativeWrite(setN);
      const set = $event(function* () {
        plain(5);
      });
      return view(function* () {
        return <button onClick={yield* set}>{yield* n}</button>;
      });
    });
    dispose = render(App, root);
    flush();
    expect(root.textContent).toBe("0");
    root.querySelector("button")!.click();
    flush();
    expect(root.textContent).toBe("5");
  });

  it("returns what the write returns and takes an updater", () => {
    let result: unknown;
    const App = component(function* () {
      const [n, setN] = yield* $signal(1);
      const plain = nativeWrite(setN);
      const set = $event(function* () {
        result = plain(v => v + 2);
      });
      return view(function* () {
        return <button onClick={yield* set}>{yield* n}</button>;
      });
    });
    dispose = render(App, root);
    flush();
    root.querySelector("button")!.click();
    flush();
    expect(root.textContent).toBe("3");
    expect(result).toBe(3);
  });

  // A dev check (D-028), as for every setter handed to plain code.
  devIt("is refused with no routine running, as any setter handed to plain code", () => {
    let plain: ((value: number) => void) | undefined;
    const App = component(function* () {
      const [n, setN] = yield* $signal(0);
      plain = nativeWrite(setN);
      return view(function* () {
        return <p>{yield* n}</p>;
      });
    });
    dispose = render(App, root);
    flush();
    expect(() => plain!(1)).toThrow(/SETTER_OUTSIDE_RUN/);
    expect(root.textContent).toBe("0");
  });
});

describe("event-phase lexical callbacks (F-S40)", () => {
  it("runs a callback prop created in a view in the child's event", () => {
    const Row = component(function* Row(props: Props<{ reload: () => void }>) {
      const run = $event(function* () {
        (yield* props.reload)();
      });
      return view(function* () {
        return <button onClick={yield* run}>go</button>;
      });
    });
    const App = component(function* () {
      const [n, setN] = yield* $signal(0);
      return view(function* () {
        return (
          <>
            <i>{yield* n}</i>
            {
              yield* Row({
                reload: nativeLexicalCallback("event", function* () {
                  yield* setN(v => v + 1);
                })
              })
            }
          </>
        );
      });
    });
    dispose = render(App, root);
    flush();
    expect(root.querySelector("i")!.textContent).toBe("0");
    root.querySelector("button")!.click();
    flush();
    root.querySelector("button")!.click();
    flush();
    expect(root.querySelector("i")!.textContent).toBe("2");
  });
});

describe("lexical callbacks keep their body's arity", () => {
  it("reports the body's parameter count", () => {
    const pair = nativeLexicalCallback("hole", function* (a: number, b: number) {
      return a + b;
    });
    expect(pair.length).toBe(2);
    expect(nativeLexicalCallback("event", function* () {}).length).toBe(0);
  });

  // Solid's Errored logs what it catches when its fallback takes no
  // parameters; Rendering's `(error, reset) => …` fallback logs nothing.
  devIt("an Errored fallback taking (error, reset) does not log what it handles", () => {
    class Boom extends Failure("boom") {}
    const logged: unknown[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args);
    });
    const Bad = component(function* Bad() {
      const n = yield* $memo(function* () {
        return yield* raise(new Boom("x"));
      });
      return view(function* () {
        return <p>{yield* n}</p>;
      });
    });
    try {
      dispose = render(
        () =>
          Errored({
            fallback: nativeLexicalCallback(
              "hole",
              function* (error: () => unknown, reset: () => void) {
                void error;
                void reset;
                return <p>caught</p>;
              }
            ),
            children: function* () {
              return <>{yield* Bad()}</>;
            }
          }),
        root
      );
      flush();
    } finally {
      spy.mockRestore();
    }
    expect(root.textContent).toBe("caught");
    expect(logged).toEqual([]);
  });
});
