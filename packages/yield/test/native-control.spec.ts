import { describe, it, expect } from "vitest";
import {
  nativeTry,
  nativeMap,
  nativeCallback,
  nativeInvoke,
  nativeLexicalCallback,
  nativeAccessor,
  nativeAccessorSetup,
  nativeGetter,
  nativeSpread,
  nativeUntrack,
  nativeUntrackSetup
} from "../src/native-control.js";
import { nativeFailure, nativeFailureValue } from "../src/native-failure.js";
import { createRoot, createSignal, createMemo, createRenderEffect, flush } from "solid-js";
import { raise, $event, getterSource, memoCompute, attempt } from "../src/runtime.js";
import type { FailsOf, Raise, Read, Write, Create, Source, Yieldable, Bind } from "../src/types.js";
import type { NativeHandled } from "../src/native-control.js";

describe("native control delegation", () => {
  it("handles branded failures and runs finally after the handler", () => {
    const order: string[] = [];
    const value = nativeFailure(["unknown"], "author value");
    const routine = nativeTry(
      function* () {
        order.push("body");
        yield* raise(value);
      },
      function* (error) {
        order.push("catch");
        return nativeFailureValue(error);
      },
      function* () {
        order.push("finally");
      }
    );
    expect(routine.next()).toEqual({ done: true, value: "author value" });
    expect(order).toEqual(["body", "catch", "finally"]);
  });
  it("passes non-failures through and still finalizes", () => {
    const pending = { pending: true };
    let handled = false,
      finalized = false;
    const routine = nativeTry(
      function* () {
        throw pending;
      },
      function* () {
        handled = true;
      },
      function* () {
        finalized = true;
      }
    );
    expect(() => routine.next()).toThrow();
    expect(handled).toBe(false);
    expect(finalized).toBe(true);
  });
  it("rethrows the same branded value", () => {
    const failure = nativeFailure(["unknown"], "failed");
    const routine = nativeTry(
      function* () {
        yield* raise(failure);
      },
      function* (error) {
        yield* raise(error);
      }
    );
    try {
      routine.next();
      throw new Error("expected failure");
    } catch (error) {
      expect(error).toBe(failure);
    }
  });
  it("delegates operations without driving them or opening a host", () => {
    const op = { write: 1 };
    const routine = nativeTry(
      function* () {
        yield op;
        return 3;
      },
      function* () {
        return 4;
      }
    );
    expect(routine.next()).toEqual({ done: false, value: op });
    expect(routine.next()).toEqual({ done: true, value: 3 });
  });
  it("maps in order, preserves holes, and snapshots array length", () => {
    const input = [1, , 3];
    const visited: number[] = [];
    const iterator = nativeMap(input, function* (value, index) {
      visited.push(index);
      input.push(9);
      yield index;
      return value! * 2;
    });
    expect(iterator.next().value).toBe(0);
    expect(iterator.next().value).toBe(2);
    const result = iterator.next();
    expect(result.done).toBe(true);
    expect(result.value).toEqual([2, , 6]);
    expect(visited).toEqual([0, 2]);
  });
});
// Handled immediate failures disappear, but writes and delayed creation survive.
type Assert<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type _Immediate = Assert<Equal<FailsOf<NativeHandled<Raise<Error> | Read<true, Error>>>, never>>;
type _Write = Assert<Equal<NativeHandled<Write>, Write>>;
type _Creation = Assert<Equal<NativeHandled<Create<"memo", Error>>, Create<"memo", Error>>>;

// A foreign callback must not silently drop its binding's failure color.
function callbackColorChecks() {
  nativeCallback(
    $event(function* () {
      return 1;
    })
  );
  const fails = $event(function* () {
    yield* raise(nativeFailure(["unknown"], "bad"));
  });
  // @ts-expect-error foreign callbacks cannot yet register this failure color
  nativeCallback(fails);
}
void callbackColorChecks;

it("invokes a captured method with its receiver even when .call is overridden", () => {
  function add(this: { n: number }, value: number) {
    return this.n + value;
  }
  Object.defineProperty(add, "call", {
    value: () => {
      throw new Error("wrong call");
    }
  });
  expect(nativeInvoke(add, { n: 3 }, [4])).toBe(7);
});

it("keeps array callbacks in the same tracked memo", () => {
  const { memo, set, dispose } = createRoot(dispose => {
    const [value, set] = createSignal(2);
    const source = getterSource(value);
    const memo = createMemo(
      memoCompute(function* () {
        return [1, 2].map(
          nativeLexicalCallback("memo", function* (item: number) {
            return item * (yield* source);
          })
        );
      })
    );
    return { memo, set, dispose };
  });
  expect(memo()).toEqual([2, 4]);
  set(3);
  flush();
  expect(memo()).toEqual([3, 6]);
  dispose();
});
it("restores an event for a deferred callback and its async continuation", async () => {
  const value = getterSource(() => 7);
  const run = $event(function* () {
    const callback = nativeLexicalCallback(
      "event",
      function* () {
        const before = yield* value;
        yield* attempt(
          () => Promise.resolve(),
          () => {}
        );
        return before + (yield* value);
      },
      true
    );
    return yield* attempt(
      () => Promise.resolve().then(callback),
      () => {}
    );
  });
  expect(await run()).toBe(14);
});

/** Drive a bridge's iterator to its value (no operation is yielded here). */
const run = <T>(y: Yieldable<unknown, T>): T => {
  const step = y[Symbol.iterator]().next();
  if (!step.done) throw new Error("the bridge yielded");
  return step.value;
};
describe("D-124 bridges", () => {
  it("a spread reads its sources where Solid's spread reads members", () => {
    const { result, set, dispose } = createRoot(dispose => {
      const [n, set] = createSignal(1);
      const spread = run(nativeSpread({ title: getterSource(n), plain: "x" }));
      const seen: unknown[] = [];
      createRenderEffect(
        () => spread.title,
        value => {
          seen.push(value);
        }
      );
      return { result: { spread, seen }, set, dispose };
    });
    flush();
    expect(result.spread.plain).toBe("x");
    set(2);
    flush();
    expect(result.seen).toEqual([1, 2]);
    expect(Object.keys(result.spread)).toEqual(["title", "plain"]);
    dispose();
  });
  it("a spread binds an $event member once, and passes others through", () => {
    let calls = 0;
    const save = $event(function* () {
      calls++;
    });
    const spread = run(nativeSpread({ onClick: save, onHover: () => calls++ }));
    expect(spread.onClick).toBe(spread.onClick);
    expect(spread.onClick).not.toBe(save);
    void spread.onClick();
    spread.onHover();
    expect(calls).toBe(2);
    expect(run(nativeSpread(null))).toBe(null);
  });
  it("untrack drives its body untracked; the host does not rerun", () => {
    const { runs, set, dispose } = createRoot(dispose => {
      const [a, setA] = createSignal(1);
      const [b, setB] = createSignal(10);
      const source = getterSource(b);
      const runs: number[] = [];
      createRenderEffect(
        () =>
          a() +
          run(
            nativeUntrack(function* () {
              return yield* source;
            })
          ),
        value => {
          runs.push(value);
        }
      );
      return { runs, set: { a: setA, b: setB }, dispose };
    });
    flush();
    set.b(20);
    flush();
    expect(runs).toEqual([11]);
    set.a(2);
    flush();
    expect(runs).toEqual([11, 22]);
    dispose();
  });
  it("untrack in setup returns its value", () => {
    const source = getterSource(() => 3) as Source<number>;
    expect(
      run(
        nativeUntrackSetup(function* () {
          return (yield* source) + 1;
        })
      )
    ).toBe(4);
  });
  it("a getter's source reads its body where it is read", () => {
    const { m, set, dispose } = createRoot(dispose => {
      const [n, set] = createSignal(2);
      const source = getterSource(n);
      const double = nativeGetter(function* () {
        return (yield* source) * 2;
      });
      const m = createMemo(() => run(double as unknown as Yieldable<unknown, number>));
      return { m, set, dispose };
    });
    flush();
    expect(m()).toBe(4);
    set(5);
    flush();
    expect(m()).toBe(10);
    dispose();
  });
  it("an accessor bridge hands plain code Solid's accessor", () => {
    const source = getterSource(() => 7) as Source<number>;
    expect(run(nativeAccessor(source))()).toBe(7);
    expect(run(nativeAccessorSetup(source))()).toBe(7);
  });
});

// The bridges' types: what each hands its host and its plain code.
declare const settled: Source<number>;
declare const pending: Source<number, never, true>;
declare const failing: Source<string, Error & { kind: "Parse" }, false>;
type Ops<Y> = Y extends Yieldable<infer O, any> ? O : never;
type Value<Y> = Y extends Yieldable<any, infer V> ? V : never;
type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
// never called: the declared sources exist only in types
export function bridgeTypes() {
  const spreadSources = nativeSpread({ title: failing, count: pending, plain: 1 });
  const spreadValues: Same<
    Value<typeof spreadSources>,
    { title: string; count: number; plain: number }
  > = true;
  const spreadReads: Same<
    Ops<typeof spreadSources>,
    Read<false, Error & { kind: "Parse" }> | Read<true, never>
  > = true;
  const spreadEvent = nativeSpread({ onClick: $event(function* () {}) });
  const spreadBinds: Same<Ops<typeof spreadEvent>, Bind<false, never>> = true;
  const untrackOps = nativeUntrack(function* () {
    return yield* pending;
  });
  const untrackKeeps: Same<Ops<typeof untrackOps>, Read<true, never>> = true;
  nativeUntrackSetup(function* () {
    return yield* settled;
  });
  // @ts-expect-error [COLORED_CAPTURE] a pending read untracked in setup
  nativeUntrackSetup(function* () {
    return yield* pending;
  });
  const getter = nativeGetter(function* () {
    return (yield* failing).length;
  });
  const getterColors: Same<typeof getter, Source<number, Error & { kind: "Parse" }, false>> = true;
  nativeAccessorSetup(settled);
  // @ts-expect-error [COLORED_CAPTURE] a pending source handed to plain code in setup
  nativeAccessorSetup(pending);
  void [spreadValues, spreadReads, spreadBinds, untrackKeeps, getterColors];
}
