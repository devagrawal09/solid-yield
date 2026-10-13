/**
 * Lenses, lens props, slots and `compose` (D-116, D-117), at run time. The
 * type half is lens.type-tests.tsx.
 */
import { createRoot, flush } from "solid-js";
import {
  attempt,
  component,
  compose,
  createSlot,
  $event,
  focus,
  $optimisticStore,
  render,
  $slot,
  $store,
  view,
  type Lens,
  type Props
} from "solid-yield";
import { toFailed } from "./failed.js";

declare const __DEV__: boolean;
const devIt = __DEV__ ? it : it.skip;

async function settle(times = 3) {
  for (let i = 0; i < times; i++) {
    await new Promise<void>(r => setTimeout(r, 0));
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
const text = (sel: string) => [...root.querySelectorAll(sel)].map(e => e.textContent);

type Counter = { n: number };
const initCounter = (): Counter => ({ n: 0 });

/** A module that gets its state as a lens prop. */
const CounterProp = component(function* CounterProp(props: Props<{ state: Lens<Counter> }>) {
  const [c, setC] = props.state;
  const inc = $event(function* () {
    yield* setC(d => {
      d.n++;
    });
  });
  return view(function* () {
    return (
      <button class="prop" onClick={yield* inc}>
        {yield* c.n}
      </button>
    );
  });
});

const CounterState = createSlot<Counter, "CounterState">({ name: "CounterState" });
/** A module that reads its state from a required slot. */
const CounterSlot = component(function* CounterSlot() {
  const [c, setC] = yield* $slot(CounterState);
  const inc = $event(function* () {
    yield* setC(d => {
      d.n++;
    });
  });
  return view(function* () {
    return (
      <button class="slot" onClick={yield* inc}>
        {yield* c.n}
      </button>
    );
  });
});
/** The same, with a local store when no provider binds the slot. */
const CounterOwn = component(function* CounterOwn() {
  const [c, setC] = yield* $slot(CounterState, { init: initCounter });
  const inc = $event(function* () {
    yield* setC(d => {
      d.n++;
    });
  });
  return view(function* () {
    return (
      <button class="own" onClick={yield* inc}>
        {yield* c.n}
      </button>
    );
  });
});

describe("focus (D-116)", () => {
  it("a focused write changes its key only, and its receipt gives the focused part", () => {
    let got: unknown;
    let bump!: () => unknown;
    const App = component(function* App() {
      const page = yield* $store({ a: { n: 1 }, b: { n: 10 } });
      const [a, setA] = focus(page, "a");
      const [state] = page;
      bump = $event(function* () {
        got = yield* setA(d => {
          d.n++;
        });
      });
      return view(function* () {
        return (
          <p>
            {yield* a.n} {yield* state.b.n}
          </p>
        );
      });
    });
    mount(App);
    expect(root.textContent).toBe("1 10");
    bump();
    flush();
    expect(root.textContent).toBe("2 10");
    expect(got).toEqual({ n: 2 });
  });

  it("a write that returns a value replaces the focused part; focus repeats", () => {
    let reset!: () => unknown;
    const App = component(function* App() {
      const page = yield* $store({ outer: { inner: { n: 5 } } });
      const [inner, setInner] = focus(focus(page, "outer"), "inner");
      reset = $event(function* () {
        yield* setInner(() => ({ n: 0 }));
      });
      return view(function* () {
        return <p>{yield* inner.n}</p>;
      });
    });
    mount(App);
    expect(root.textContent).toBe("5");
    reset();
    flush();
    expect(root.textContent).toBe("0");
  });

  it("a focused write on an $optimisticStore shows at once and reverts when the event settles", async () => {
    let resolve!: () => void;
    let add!: () => unknown;
    const App = component(function* App() {
      const list = yield* $optimisticStore({ draft: { items: ["a"] } });
      const [draft, setDraft] = focus(list, "draft");
      add = $event(function* () {
        yield* setDraft(d => {
          d.items.push("b");
        });
        yield* attempt(() => new Promise<void>(r => (resolve = r)), toFailed);
      });
      return view(function* () {
        return <p>{(yield* draft.items).join(",")}</p>;
      });
    });
    mount(App);
    add();
    flush();
    expect(root.textContent).toBe("a,b");
    resolve();
    await settle();
    expect(root.textContent).toBe("a");
  });

  it("refuses what is not a lens", () => {
    expect(() => focus([1, 2] as any, "x" as never)).toThrow(/NOT_A_LENS/);
  });
});

describe("lens props (D-116, amends D-042)", () => {
  it("a lens prop is given as it is: the module writes its part of the parent's store", () => {
    const App = component(function* App() {
      const page = yield* $store({ left: initCounter(), right: initCounter() });
      const [state] = page;
      return view(function* () {
        return (
          <div>
            {yield* CounterProp({ state: focus(page, "left") })}
            {yield* CounterProp({ state: focus(page, "right") })}
            <i>{(yield* state.left.n) + (yield* state.right.n)}</i>
          </div>
        );
      });
    });
    mount(App);
    const [left, right] = root.querySelectorAll("button");
    left.click();
    left.click();
    right.click();
    flush();
    expect(text("button")).toEqual(["2", "1"]);
    expect(text("i")).toEqual(["3"]);
  });

  it("any other prop is still a path", () => {
    let seen: unknown;
    const Child = component(function* Child(props: Props<{ pair: readonly [number, number] }>) {
      seen = Array.isArray(props.pair);
      return view(function* () {
        return <p>{(yield* props.pair).join("+")}</p>;
      });
    });
    const App = component(function* App() {
      return view(function* () {
        return <div>{yield* Child({ pair: [1, 2] })}</div>;
      });
    });
    mount(App);
    expect(seen).toBe(false);
    expect(root.textContent).toBe("1+2");
  });
});

describe("slots (D-117)", () => {
  it("a provider binds the slot to a lens; the reader writes the parent's store", () => {
    const App = component(function* App() {
      const page = yield* $store({ counter: initCounter() });
      const [state] = page;
      return view(function* () {
        return (
          <div>
            {
              yield* CounterState.provide({
                value: focus(page, "counter"),
                children: function* () {
                  return <span>{yield* CounterSlot()}</span>;
                }
              })
            }
            <i>{yield* state.counter.n}</i>
          </div>
        );
      });
    });
    mount(App);
    root.querySelector("button")!.click();
    flush();
    expect(text("button")).toEqual(["1"]);
    expect(text("i")).toEqual(["1"]);
  });

  it("the init form makes one local store per instance when no provider binds the slot", () => {
    const App = component(function* App() {
      return view(function* () {
        return (
          <div>
            {yield* CounterOwn()}
            {yield* CounterOwn()}
          </div>
        );
      });
    });
    mount(App);
    root.querySelectorAll("button")[1].click();
    flush();
    expect(text("button")).toEqual(["0", "1"]);
  });

  it("the init form uses the provider when there is one", () => {
    const App = component(function* App() {
      const page = yield* $store({ counter: { n: 7 } });
      return view(function* () {
        return (
          <div>
            {
              yield* CounterState.provide({
                value: focus(page, "counter"),
                children: function* () {
                  return <span>{yield* CounterOwn()}</span>;
                }
              })
            }
          </div>
        );
      });
    });
    mount(App);
    expect(text("button")).toEqual(["7"]);
  });

  devIt("the required form without a provider is NO_PROVIDER, naming the slot", () => {
    expect(() => createRoot(() => (CounterSlot as any)())).toThrow(
      /NO_PROVIDER.*CounterSlot.*CounterState/
    );
  });

  it("a slot is not read as a context", () => {
    const Bad = component(function* Bad() {
      yield* CounterState as any;
      return view(function* () {
        return <p />;
      });
    });
    expect(() => createRoot(() => (Bad as any)())).toThrow(/SLOT_READ.*\$slot\(CounterState\)/);
  });

  devIt("$slot belongs to a setup", () => {
    const InView = component(function* InView() {
      // @ts-expect-error a view only reads (Create is not a ViewOp)
      return view(function* () {
        const [c] = yield* $slot(CounterState, { init: initCounter });
        return <i>{yield* c.n}</i>;
      });
    });
    expect(() => createRoot(() => InView())).toThrow(/CREATE_OUTSIDE_SETUP.*\$slot/);
  });
});

describe("compose (D-117)", () => {
  const Page = compose({
    counter: { init: initCounter, slot: CounterState },
    other: { init: initCounter }
  });

  it("one container: slots bound by provide, the rest given as lens props", () => {
    let reset!: () => unknown;
    const App = component(function* App() {
      const page = yield* Page.$store();
      const parts = Page.lenses(page);
      const [state, setPage] = page;
      reset = $event(function* () {
        yield* setPage(() => Page.init());
      });
      return view(function* () {
        return (
          <div>
            {
              yield* Page.provide({
                value: page,
                children: function* () {
                  return (
                    <span>
                      {yield* CounterSlot()}
                      {yield* CounterProp({ state: parts.other })}
                    </span>
                  );
                }
              })
            }
            <i>{(yield* state.counter.n) * 10 + (yield* state.other.n)}</i>
          </div>
        );
      });
    });
    mount(App);
    (root.querySelector(".slot") as HTMLElement).click();
    (root.querySelector(".prop") as HTMLElement).click();
    (root.querySelector(".prop") as HTMLElement).click();
    flush();
    expect(text("button")).toEqual(["1", "2"]);
    expect(text("i")).toEqual(["12"]);
    reset();
    flush();
    expect(text("button")).toEqual(["0", "0"]);
    expect(text("i")).toEqual(["0"]);
  });

  it("nests: a composer's state is an entry of a larger one", () => {
    const Inner = compose({ counter: { init: initCounter, slot: CounterState } });
    const Outer = compose({ inner: { init: Inner.init } });
    const App = component(function* App() {
      const app = yield* Outer.$store();
      const { inner } = Outer.lenses(app);
      return view(function* () {
        return (
          <div>
            {
              yield* Inner.provide({
                value: inner,
                children: function* () {
                  return <span>{yield* CounterSlot()}</span>;
                }
              })
            }
          </div>
        );
      });
    });
    mount(App);
    root.querySelector("button")!.click();
    flush();
    expect(text("button")).toEqual(["1"]);
  });

  it("provide with no slot renders its children", () => {
    const Plain = compose({ other: { init: initCounter } });
    const App = component(function* App() {
      const page = yield* Plain.$store();
      return view(function* () {
        return (
          <div>
            {
              yield* Plain.provide({
                value: page,
                children: function* () {
                  return <span>{yield* CounterProp({ state: Plain.lenses(page).other })}</span>;
                }
              })
            }
          </div>
        );
      });
    });
    mount(App);
    expect(text("button")).toEqual(["0"]);
  });
});
