import { describe, it, expect } from "vitest";
import {
  nativeTry,
  nativeMap,
  nativeCallback,
  nativeInvoke,
  nativeLexicalCallback
} from "../src/native-control.js";
import { nativeFailure, nativeFailureValue } from "../src/native-failure.js";
import { createRoot, createSignal, createMemo, flush } from "solid-js";
import { raise, $event, getterSource, memoCompute, attempt } from "../src/runtime.js";
import type { FailsOf, Raise, Read, Write, Create } from "../src/types.js";
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
