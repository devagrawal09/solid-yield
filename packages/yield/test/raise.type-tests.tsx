/**
 * Type tests for `raise` at every host (Phase 4 item 2; raise.spec.tsx is
 * the runtime half). Each position pins what `FailsOf` makes of a raised
 * `Boom`: where it lands in a type, or that it lands nowhere. Exact types,
 * not assignability: `Expect<Equal<A, B>>`. Type-checked by `test-types`.
 */
import {
  attempt,
  $cleanup,
  $component,
  $effect,
  $event,
  $memo,
  $settled,
  $signal,
  Errored,
  For,
  foreign,
  lazy,
  Loading,
  raise,
  until,
  Show,
  view,
  type Bind,
  type BoundEvent,
  type Create,
  type EventCallOp,
  type EventHandler,
  type HView,
  type Path,
  type Reset,
  type FailsOf,
  type ForeignCheck,
  type Props,
  type Raise,
  type Read,
  type Source,
  type SettledView,
  type StreamAttempt,
  type View,
  type Wait,
  type Yieldable
} from "solid-yield";
import { h } from "solid-yield/h";
import type { Handled } from "../src/types.js";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
/** A view's failures (its second color). */
type ViewFailsOf<V> = V extends View<boolean, infer E> ? E : never;
/** A view's pending flag (its first color). */
type ViewPendingOf<V> = V extends View<infer P, unknown> ? P : never;
/** A view's may-wait marker (D-075): not a color. */
type ViewMayWaitOf<V> = V extends View<boolean, unknown, infer W> ? W : never;

class Boom extends Error {
  readonly kind = "boom" as const;
}
class Other extends Error {
  readonly kind = "other" as const;
}

// --- the op itself --------------------------------------------------------------------
// `raise(e)` is a `Raise<E>` op: FailsOf of it is E, and of a union of raises the union
export type RaiseOp = Expect<Equal<FailsOf<Raise<Boom>>, Boom>>;
export type RaiseUnion = Expect<Equal<FailsOf<Raise<Boom> | Raise<Other>>, Boom | Other>>;

// --- setup: refused -------------------------------------------------------------------
// A setup creates; it never reads (D-042), so it has nothing to fail on: Raise is not a
// SetupOp. (At run time a raise reached through a cast still reaches the nearest Errored;
// raise.spec.tsx.)
// @ts-expect-error Raise is not a SetupOp
export const SetupRaises = $component(function* SetupRaises() {
  yield* raise(new Boom());
  return view(function* () {
    return <i />;
  });
});

// --- a hole: a zero-arity function* given as a prop (D-065), read in the child's hole -----
const Child = $component(function* Child(props: Props<{ n: Source<number, Boom> }>) {
  return view(function* () {
    return <i>{yield* props.n}</i>;
  });
});
export const Hole = $component(function* Hole() {
  return view(function* () {
    return (
      <b>
        {
          yield* Child({
            n: function* () {
              return yield* raise(new Boom());
            }
          })
        }
      </b>
    );
  });
});
export type HoleChild = Expect<Equal<ViewFailsOf<ReturnType<typeof Child>>, Boom>>;
export type HoleCaller = Expect<Equal<ViewFailsOf<ReturnType<typeof Hole>>, Boom>>;
// a flow control's source hole (D-038): its raise colors the flow control's output. The
// hole always raises (it returns `never`): until D-070 F3 that dropped its Raise entirely.
export const When = $component(function* When() {
  return view(function* () {
    return (
      <p>
        {
          yield* Show({
            when: function* () {
              return yield* raise(new Boom());
            },
            children: function* () {
              return <i />;
            }
          })
        }
      </p>
    );
  });
});
export type WhenCaller = Expect<Equal<ViewFailsOf<ReturnType<typeof When>>, Boom>>;
// a hole that raises is refused for a prop declared settled (D-024)
const Settled = $component(function* Settled(props: Props<{ n: number }>) {
  return view(function* () {
    return <i>{yield* props.n}</i>;
  });
});
export const settledRefuses = Settled({
  // @ts-expect-error the hole raises; `n` is settled
  n: function* () {
    return yield* raise(new Boom());
  }
});

// --- memo: its source fails with what it raises; a hole reading it colors the view ------
export const Memo = $component(function* Memo() {
  const m = yield* $memo(function* () {
    const [flag] = [true];
    if (flag) yield* raise(new Boom());
    return 1;
  });
  type _memo = Expect<Equal<typeof m, Source<number, Boom>>>;
  return view(function* () {
    return <i>{yield* m}</i>;
  });
});
export type MemoView = Expect<Equal<ViewFailsOf<ReturnType<typeof Memo>>, Boom>>;
export type MemoSettled = Expect<Equal<ViewPendingOf<ReturnType<typeof Memo>>, false>>;
// two raises: the union
export const MemoTwo = $component(function* MemoTwo() {
  const m = yield* $memo(function* () {
    const [a, b] = [true, false];
    if (a) yield* raise(new Boom());
    if (b) yield* raise(new Other());
    return 1;
  });
  return view(function* () {
    return <i>{yield* m}</i>;
  });
});
export type MemoTwoView = Expect<Equal<ViewFailsOf<ReturnType<typeof MemoTwo>>, Boom | Other>>;

// --- effect: its raise joins the component's failures (D-073) -------------------------------
// `$effect` / `$settled` give `Yieldable<Create<…, FailsOf<body>>, void>`: what the body
// raises is in the setup's yield union, and so in the component's view, as it fails at run
// time (to the nearest Errored above the component, or re-thrown; raise.spec.tsx).
export const Effect = $component(function* Effect() {
  yield* $effect(
    function* () {},
    function* () {
      yield* raise(new Boom());
    }
  );
  yield* $settled(function* () {
    yield* raise(new Other());
  });
  return view(function* () {
    return <i />;
  });
});
export type EffectView = Expect<Equal<ViewFailsOf<ReturnType<typeof Effect>>, Boom | Other>>;
export type EffectSettled = Expect<Equal<ViewPendingOf<ReturnType<typeof Effect>>, false>>;
export type EffectCreate = Expect<
  Equal<
    ReturnType<typeof $effect<Raise<Boom>>> extends Yieldable<infer Y, void> ? Y : never,
    Create<"effect", Boom>
  >
>;
// an effect that handles its failure itself — an attempt whose `onError` absorbs it (returns
// nothing, D-076) — adds none; the attempt gives `T | undefined`
export const EffectAbsorbs = $component(function* EffectAbsorbs() {
  yield* $effect(
    function* () {},
    function* () {
      const v = yield* attempt(
        () => JSON.parse("{") as unknown,
        () => {}
      );
      type _v = Expect<Equal<typeof v, unknown>>;
    }
  );
  yield* $settled(function* () {
    const n = yield* attempt(
      () => 1,
      () => undefined
    );
    type _n = Expect<Equal<typeof n, number | undefined>>;
    // a fallback is `??`
    const m =
      (yield* attempt(
        () => 1,
        () => {}
      )) ?? 0;
    type _m = Expect<Equal<typeof m, number>>;
  });
  return view(function* () {
    return <i />;
  });
});
export type EffectAbsorbsView = Expect<Equal<ViewFailsOf<ReturnType<typeof EffectAbsorbs>>, never>>;
// …while an attempt whose `onError` returns the failure joins it
export const EffectAttempt = $component(function* EffectAttempt() {
  yield* $effect(
    function* () {},
    function* () {
      yield* attempt(
        () => JSON.parse("{") as unknown,
        cause => new Boom(String(cause))
      );
    }
  );
  return view(function* () {
    return <i />;
  });
});
export type EffectAttemptView = Expect<Equal<ViewFailsOf<ReturnType<typeof EffectAttempt>>, Boom>>;
// D-076 / D-078: a handler returns the failure (an Error with a literal kind) or absorbs it, never both
export const mixed = attempt(
  () => 1,
  // @ts-expect-error [ATTEMPT_ABSORBS]: one handler, one meaning
  () => (Math.random() > 0.5 ? new Boom() : undefined)
);
export const mixedStatements = attempt(
  () => 1,
  // @ts-expect-error [ATTEMPT_ABSORBS]: returns a Boom on one path, nothing on the other
  (cause: unknown) => {
    if (cause instanceof Boom) return cause;
  }
);
// D-078 (amends D-076): a value absorbs too, and the attempt gives it: T | V
export const valueHandler = attempt(
  () => 1,
  () => "none" as const
);
export type ValueHandler = Expect<Equal<typeof valueHandler, Yieldable<never, number | "none">>>;
export const nullHandler = attempt(
  () => Promise.resolve(1),
  () => null
);
export type NullHandler = Expect<Equal<typeof nullHandler, Yieldable<Wait, number | null>>>;
export const maybeValue = attempt(
  () => 1,
  () => (Math.random() > 0.5 ? 0 : undefined)
);
export type MaybeValue = Expect<Equal<typeof maybeValue, Yieldable<never, number | undefined>>>;
// a failure without a literal kind is still [FAILURE_KIND]
export const plainError = attempt(
  () => 1,
  // @ts-expect-error [FAILURE_KIND]
  () => new Error("x")
);
// returning the failure: a Raise of it, the value as is; returning nothing: no Raise, T | undefined
export type ReturnsFailure = Expect<
  Equal<ReturnType<typeof attempt<Promise<number>, Boom>>, Yieldable<Wait | Raise<Boom>, number>>
>;
export type ReturnsNothing = Expect<
  Equal<ReturnType<typeof attempt<Promise<number>, void>>, Yieldable<Wait, number | undefined>>
>;
// --- D-078: a generator handler is routine code of the host -----------------------------
declare const n: Source<number, never, true>;
declare const flaky: () => Promise<string>;
// its ops are the host's and join the attempt's; its return decides: an Error fails …
export const genTransform = attempt(flaky, function* (cause) {
  const k = yield* n;
  return new Boom(`${k}: ${String(cause)}`);
});
export type GenTransform = Expect<
  Equal<typeof genTransform, Yieldable<Wait | Read<true, never> | Raise<Boom>, string>>
>;
// … nothing absorbs (T | undefined) …
export const genVoid = attempt(flaky, function* () {
  yield* n;
});
export type GenVoid = Expect<
  Equal<typeof genVoid, Yieldable<Wait | Read<true, never>, string | undefined>>
>;
// … a value absorbs, the attempt gives it: a nested attempt is a retry or a fallback
export const genRetry = attempt(flaky, function* () {
  return yield* attempt(flaky, () => "fallback" as const);
});
export type GenRetry = Expect<Equal<typeof genRetry, Yieldable<Wait, string>>>;
// `yield* raise(e)` in it fails the attempt with e
export const genRaise = attempt(flaky, function* () {
  yield* raise(new Other());
});
export type GenRaise = Expect<
  Equal<typeof genRaise, Yieldable<Wait | Raise<Other>, string | undefined>>
>;
// a generator returning an Error on one path and nothing on another is [ATTEMPT_ABSORBS]
export const genMixed = attempt(
  flaky,
  // @ts-expect-error [ATTEMPT_ABSORBS]
  function* (cause) {
    if ((yield* n) > 0) return new Boom(String(cause));
  }
);
// host-op admission: a write in an event's handler is the event's …
export const HandlerHosts = $component(function* HandlerHosts() {
  const [count, setCount] = yield* $signal(0);
  const save = $event(function* () {
    yield* attempt(flaky, function* () {
      yield* setCount(c => c + 1);
      return yield* attempt(flaky, () => {});
    });
  });
  type _save = Expect<Equal<typeof save, EventHandler<[], never, void, false, true>>>;
  // … but not a memo's: a Write is not a MemoOp
  // @ts-expect-error a write in a memo's handler
  const m = yield* $memo(function* () {
    return yield* attempt(flaky, function* () {
      yield* setCount(0);
      return "x";
    });
  });
  // a memo's handler reads and raises: its colors are the memo's
  const failing = yield* $memo(function* () {
    return yield* attempt(flaky, function* () {
      if ((yield* count) > 1) yield* raise(new Boom());
      return "x";
    });
  });
  type _failing = Expect<Equal<typeof failing, Source<string, Boom, true>>>;
  // an effect's handler is synchronous: a wait in it is not an EffectOp
  yield* $effect(
    function* () {},
    // @ts-expect-error an async nested attempt in an effect's handler
    function* () {
      yield* attempt(
        () => JSON.parse("{") as unknown,
        function* () {
          return yield* attempt(flaky, () => {});
        }
      );
    }
  );
  void m;
  return view(function* () {
    return <button onClick={yield* save}>{yield* count}</button>;
  });
});
// until's handler follows the same rule
export const untilGen = until(n, function* () {
  return 0;
});
export type UntilGen = Expect<Equal<typeof untilGen, Yieldable<Wait, number>>>;

// --- D-079: $effect(compute, effect) ----------------------------------------------------
// the compute's value is the effect phase's (and the previous one, undefined at first)
export const Split = $component(function* Split() {
  const [count, setCount] = yield* $signal(0);
  const [label, setLabel] = yield* $signal("");
  yield* $effect(
    function* () {
      return { n: yield* count, at: "now" as const };
    },
    function* (value, prev) {
      type _value = Expect<Equal<typeof value, { n: number; at: "now" }>>;
      type _prev = Expect<Equal<typeof prev, { n: number; at: "now" } | undefined>>;
      // the effect phase writes, cleans up, and reads: untracked, because its host is (D-083)
      yield* setLabel(`${value.n}${yield* label}`);
      yield* $cleanup(() => {});
    }
  );
  // the compute is pure: no write …
  yield* $effect(
    // @ts-expect-error a Write is not a ComputeOp
    function* () {
      yield* setCount(1);
    },
    function* () {}
  );
  // … no $cleanup …
  yield* $effect(
    // @ts-expect-error a Cleanup is not a ComputeOp
    function* () {
      yield* $cleanup(() => {});
    },
    function* () {}
  );
  // … no event call
  const sync = $event(function* () {});
  yield* $effect(
    // @ts-expect-error an EventCallOp is not a ComputeOp
    function* () {
      yield* sync();
    },
    function* () {}
  );
  // the effect phase does not wait: a read of a source that may be pending is refused (read
  // it in the compute and pass the value)
  yield* $effect(
    function* () {},
    // @ts-expect-error a pending Read is not an EffectPhaseOp
    function* () {
      void (yield* n);
    }
  );
  return view(function* () {
    return <i>{yield* label}</i>;
  });
});
// both halves' failures are the component's (D-073 for the compute; the effect phase's take
// the same runtime path)
export const SplitFails = $component(function* SplitFails() {
  const [n] = yield* $signal(0);
  yield* $effect(
    function* () {
      if ((yield* n) > 1) yield* raise(new Boom());
      return yield* n;
    },
    function* (v) {
      if (v > 2) yield* raise(new Other());
    }
  );
  return view(function* () {
    return <i />;
  });
});
export type SplitFailsView = Expect<
  Equal<ViewFailsOf<ReturnType<typeof SplitFails>>, Boom | Other>
>;
export type SplitCreate = Expect<
  Equal<
    ReturnType<typeof $effect<Raise<Boom>, number, Raise<Other>>> extends Yieldable<infer Y, void>
      ? Y
      : never,
    Create<"effect", Boom | Other>
  >
>;

// an effect delegating to a synchronous event that fails joins the event's failure
export const EffectCalls = $component(function* EffectCalls() {
  const fail = $event(function* () {
    yield* raise(new Other());
  });
  yield* $effect(
    function* () {},
    function* () {
      yield* fail();
    }
  );
  return view(function* () {
    return <i />;
  });
});
export type EffectCallsView = Expect<Equal<ViewFailsOf<ReturnType<typeof EffectCalls>>, Other>>;
// a row's effect joins the flow control's output, and the holding view
export const RowEffect = $component(function* RowEffect() {
  const [items] = yield* $signal([1]);
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: items,
            children: function* () {
              yield* $effect(
                function* () {},
                function* () {
                  yield* raise(new Boom());
                }
              );
              return view(function* () {
                return <li />;
              });
            }
          })
        }
      </ul>
    );
  });
});
export type RowEffectView = Expect<Equal<ViewFailsOf<ReturnType<typeof RowEffect>>, Boom>>;

// --- event: the handler's type carries it; binding it gives it to the view (D-072) -----------
export const Event = $component(function* Event() {
  const go = $event(function* () {
    yield* raise(new Boom());
  });
  type _handler = Expect<Equal<typeof go, EventHandler<[], Boom, void, false, false>>>;
  // calling it from another event joins its failure to that event's (`yield* go()`)
  const outer = $event(function* () {
    yield* go();
  });
  type _outer = Expect<Equal<typeof outer, EventHandler<[], Boom, void, false, false>>>;
  return view(function* () {
    return (
      <button onClick={yield* go} onDblClick={yield* outer}>
        go
      </button>
    );
  });
});
// binding it (`onClick={yield* go}`, a Bind op) gives the view its failure: a DOM dispatch's
// failure reaches the nearest Errored above the bind site (D-085)
export type EventView = Expect<Equal<ViewFailsOf<ReturnType<typeof Event>>, Boom>>;
export type EventViewSettled = Expect<Equal<ViewPendingOf<ReturnType<typeof Event>>, false>>;
export type EventViewNoWait = Expect<Equal<ViewMayWaitOf<ReturnType<typeof Event>>, false>>;
// the bind is the handler, un-called and branded; the call is an EventCallOp (D-072)
export type BindOp = Expect<
  Equal<
    ReturnType<EventHandler<[], Boom, void, true, false>[typeof Symbol.iterator]>,
    Generator<Bind<true, Boom>, BoundEvent<[]>, any>
  >
>;
// an event that may wait on a pending read (`P`) does not make the view binding it pending:
// the runtime never suspends a view for a call. The view carries the may-wait marker
// instead (D-075 amended), which no boundary handles and the lint's no-unshown-wait reports
export const EventPending = $component(function* EventPending(
  props: Props<{ n: Source<number, never, true> }>
) {
  const go = $event(function* () {
    yield* props.n;
  });
  type _go = Expect<Equal<typeof go, EventHandler<[], never, void, true, false>>>;
  return view(function* () {
    return <button onClick={yield* go}>go</button>;
  });
});
export type EventPendingView = Expect<Equal<ViewPendingOf<ReturnType<typeof EventPending>>, false>>;
export type EventPendingMayWait = Expect<
  Equal<ViewMayWaitOf<ReturnType<typeof EventPending>>, true>
>;
// so it is an element: a settled view, needing no Loading
export const eventPendingElement: SettledView = EventPending({ n: pendingN });
// the marker folds like pending: through a flow control's content and a child view
export const EventPendingNested = $component(function* EventPendingNested(
  props: Props<{ n: Source<number, never, true> }>
) {
  const go = $event(function* () {
    yield* props.n;
  });
  return view(function* () {
    return (
      <div>
        {
          yield* Show({
            when: true,
            children: function* () {
              return <button onClick={yield* go}>go</button>;
            }
          })
        }
      </div>
    );
  });
});
export type EventPendingNestedView = Expect<
  Equal<ViewPendingOf<ReturnType<typeof EventPendingNested>>, false>
>;
export type EventPendingNestedMayWait = Expect<
  Equal<ViewMayWaitOf<ReturnType<typeof EventPendingNested>>, true>
>;
export const EventPendingParent = $component(function* EventPendingParent() {
  return view(function* () {
    return <div>{yield* EventPending({ n: pendingN })}</div>;
  });
});
export type EventPendingParentView = Expect<
  Equal<ViewPendingOf<ReturnType<typeof EventPendingParent>>, false>
>;
export type EventPendingParentMayWait = Expect<
  Equal<ViewMayWaitOf<ReturnType<typeof EventPendingParent>>, true>
>;
// async work of its own (`A`) is not pending: the view does not wait for a call
export const EventAsync = $component(function* EventAsync() {
  const go = $event(function* () {
    yield* attempt(
      () => Promise.resolve(1),
      cause => new Boom(String(cause))
    );
  });
  return view(function* () {
    return <button onClick={yield* go}>go</button>;
  });
});
export type EventAsyncView = Expect<Equal<ViewPendingOf<ReturnType<typeof EventAsync>>, false>>;
export type EventAsyncFails = Expect<Equal<ViewFailsOf<ReturnType<typeof EventAsync>>, Boom>>;
// the bound-data form, `[yield* pick, data]`: pick(data, event)
export const EventData = $component(function* EventData() {
  const pick = $event(function* (value: string) {
    if (value === "") yield* raise(new Other());
  });
  return view(function* () {
    return <button onClick={[yield* pick, "a"]}>go</button>;
  });
});
export type EventDataView = Expect<Equal<ViewFailsOf<ReturnType<typeof EventData>>, Other>>;
// in `h`, an `$event` handler given as an attribute is the bind: it carries the same colors
export const hBound = h("button", {
  onClick: null as unknown as EventHandler<[], Boom, void, true, false>
});
export type HBound = Expect<Equal<typeof hBound, HView<false, Boom, true>>>;
// bind belongs to a view: an event, a memo or a hole prop does not bind
export const NoBindInEvent = $component(function* NoBindInEvent() {
  const go = $event(function* () {});
  // @ts-expect-error Bind is not an EventOp: an event calls another (`yield* go()`)
  const outer = $event(function* () {
    yield* go;
  });
  // @ts-expect-error Bind is not a MemoOp
  const m = yield* $memo(function* () {
    return yield* go;
  });
  void outer;
  void m;
  return view(function* () {
    return <i />;
  });
});

// --- row: a row's raise joins the flow control's output, and the holding view (D-059) -------
export const Row = $component(function* Row() {
  const [items] = yield* $signal([1]);
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: items,
            children: function* (item) {
              const m = yield* $memo(function* () {
                const v = yield* item;
                if (v > 0) yield* raise(new Boom());
                return v;
              });
              return view(function* () {
                return <li>{yield* m}</li>;
              });
            }
          })
        }
      </ul>
    );
  });
});
export type RowView = Expect<Equal<ViewFailsOf<ReturnType<typeof Row>>, Boom>>;

// --- an event attribute takes a bound `$event` handler, nothing else (D-072) ---------------
export const Refusals = $component(function* Refusals(
  props: Props<{ onSave: EventHandler<[], Boom, void, false, false>; fn: () => void }>
) {
  const go = $event(function* () {});
  const [fn] = yield* $signal<() => void>(() => {});
  return view(function* () {
    return (
      <>
        {/* @ts-expect-error unbound: its colors would reach no type (lint: no-unbound-event) */}
        <button onClick={go}>a</button>
        {/* @ts-expect-error a source's value is not a bound handler */}
        <button onClick={yield* fn}>b</button>
        {/* @ts-expect-error a plain function: the DOM would call it with its colors in no type */}
        <button onClick={() => {}}>c</button>
        {/* @ts-expect-error a handler read from a prop is a source's value: wrap it in an $event */}
        <button onClick={yield* props.onSave}>d</button>
        {/* @ts-expect-error a plain-function prop either */}
        <button onClick={yield* props.fn}>e</button>
      </>
    );
  });
});
// a handler given as a prop is called by an $event of the child's, which joins its colors
export const ForwardsHandler = $component(function* ForwardsHandler(
  props: Props<{ onSave: EventHandler<[], Boom, void, false, false> }>
) {
  const save = $event(function* () {
    yield* (yield* props.onSave)();
  });
  return view(function* () {
    return <button onClick={yield* save}>save</button>;
  });
});
export type ForwardsHandlerView = Expect<
  Equal<ViewFailsOf<ReturnType<typeof ForwardsHandler>>, Boom>
>;

// --- Errored: reset is already bound; a row fallback binds; the fallback's colors pass on -----
export const ResetBound = $component(function* ResetBound() {
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            fallback: (_err, reset) => <button onClick={reset}>reset</button>,
            children: function* () {
              return <>{yield* Fails()}</>;
            }
          })
        }
      </>
    );
  });
});
export type ResetBoundView = Expect<Equal<ViewFailsOf<ReturnType<typeof ResetBound>>, never>>;
const Fails = $component(function* Fails() {
  const m = yield* $memo(function* () {
    return yield* raise(new Boom());
  });
  return view(function* () {
    return <i>{yield* m}</i>;
  });
});
// a row fallback: its error is a path, its handlers are bound, its failures pass on (D-071)
export const RowFallback = $component(function* RowFallback() {
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            // its parameters are annotated: TypeScript does not infer a generator fallback's
            fallback: function* (err: Path<Boom>, reset: Reset) {
              const again = $event(function* (r: Reset) {
                yield* raise(new Other());
                r();
              });
              return view(function* () {
                return (
                  <p>
                    {(yield* err).message}
                    <button onClick={[yield* again, reset]}>again</button>
                  </p>
                );
              });
            },
            children: function* () {
              return <>{yield* Fails()}</>;
            }
          })
        }
      </>
    );
  });
});
export type RowFallbackView = Expect<Equal<ViewFailsOf<ReturnType<typeof RowFallback>>, Other>>;
// a lazy-view fallback's colors pass on too (before D-071 they were dropped)
const Pends = $component(function* Pends(props: Props<{ n: Source<number, never, true> }>) {
  return view(function* () {
    return <i>{yield* props.n}</i>;
  });
});
declare const pendingN: Source<number, never, true>;
export const LazyFallback = $component(function* LazyFallback() {
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            fallback: function* () {
              return <>{yield* Pends({ n: pendingN })}</>;
            },
            children: function* () {
              return <>{yield* Fails()}</>;
            }
          })
        }
      </>
    );
  });
});
export type LazyFallbackView = Expect<Equal<ViewPendingOf<ReturnType<typeof LazyFallback>>, true>>;

// --- Loading: `on`'s failures and the fallback's colors pass on (D-071) ---------------------
// `on`'s pending is the boundary's own (runtime.spec, "Loading's on"); its failure is not a
// Loading's to handle. The h flavor says the same as the call form.
declare const failingKey: Source<string, Boom, true>;
const loadingOn = Loading({
  on: failingKey,
  fallback: "…",
  children: function* () {
    return <>{yield* Pends({ n: pendingN })}</>;
  }
});
export type LoadingOnFails = Expect<Equal<ViewFailsOf<typeof loadingOn>, Boom>>;
export type LoadingOnPending = Expect<Equal<ViewPendingOf<typeof loadingOn>, false>>;
const loadingFallback = Loading({
  fallback: function* () {
    return (
      <>
        {yield* Fails()}
        {yield* Pends({ n: pendingN })}
      </>
    );
  },
  children: "x"
});
export type LoadingFallbackFails = Expect<Equal<ViewFailsOf<typeof loadingFallback>, Boom>>;
export type LoadingFallbackPending = Expect<Equal<ViewPendingOf<typeof loadingFallback>, true>>;
type HFails<V> = V extends HView<boolean, infer E> ? E : never;
type HPending<V> = V extends HView<infer P, unknown> ? P : never;
const hLoadingOn = h(Loading, { on: failingKey, fallback: "…" }, h(Pends, { n: pendingN }));
export type HLoadingOnFails = Expect<Equal<HFails<typeof hLoadingOn>, Boom>>;
export type HLoadingOnPending = Expect<Equal<HPending<typeof hLoadingOn>, false>>;
const hLoadingFallback = h(Loading, { fallback: h(Fails, {}) }, "x");
export type HLoadingFallbackFails = Expect<Equal<HFails<typeof hLoadingFallback>, Boom>>;
const hLoadingPendingFallback = h(Loading, { fallback: h(Pends, { n: pendingN }) }, "x");
export type HLoadingFallbackPending = Expect<Equal<HPending<typeof hLoadingPendingFallback>, true>>;
const hLoadingPlain = h(Loading, { fallback: "…" }, h(Pends, { n: pendingN }));
export type HLoadingPlain = Expect<
  Equal<HPending<typeof hLoadingPlain> | HFails<typeof hLoadingPlain>, false>
>;

// --- D-077: attempt over an event call ------------------------------------------------
// `yield* attempt(() => go(), onError)` is `yield* go()` with the call's failure handled: the
// handler receives the call's known failure (its FailsOf), and the call's other colors stay
declare const failing: EventHandler<[], Boom | Other, number, true, true>;
declare const failingSync: EventHandler<[], Boom, number, false, false>;
// absorbed: the call's failure is gone from the type, its value may be undefined
export const absorbCall = attempt(
  () => failing(),
  e => {
    type _e = Expect<Equal<typeof e, Boom | Other>>;
  }
);
export type AbsorbCall = Expect<
  Equal<typeof absorbCall, Yieldable<EventCallOp<true, true, never>, number | undefined>>
>;
export type AbsorbCallFails = Expect<
  Equal<FailsOf<typeof absorbCall extends Yieldable<infer Y, any> ? Y : never>, never>
>;
// transformed: the handler's failure replaces the call's
export const transformCall = attempt(
  () => failing(),
  e => new Other(e.kind)
);
export type TransformCall = Expect<
  Equal<typeof transformCall, Yieldable<EventCallOp<true, true, never> | Raise<Other>, number>>
>;
// returned as it is: the call's own failure (narrowed, here)
export const keepBoom = attempt(
  () => failing(),
  e => (e instanceof Boom ? e : new Boom(e.message))
);
export type KeepBoom = Expect<
  Equal<FailsOf<typeof keepBoom extends Yieldable<infer Y, any> ? Y : never>, Boom>
>;
// in an event the caller's type follows: absorbed, none of the call's failures
export const AttemptCallEvent = $component(function* AttemptCallEvent() {
  const outer = $event(function* () {
    return yield* attempt(
      () => failing(),
      () => {}
    );
  });
  type _outer = Expect<
    Equal<typeof outer, EventHandler<[], never, number | undefined, true, true>>
  >;
  return view(function* () {
    return <button onClick={yield* outer}>go</button>;
  });
});
export type AttemptCallEventView = Expect<
  Equal<ViewFailsOf<ReturnType<typeof AttemptCallEvent>>, never>
>;
// an effect may attempt a synchronous call (as it may delegate to one), absorbing its failure
export const AttemptCallEffect = $component(function* AttemptCallEffect() {
  yield* $effect(
    function* () {},
    function* () {
      yield* attempt(
        () => failingSync(),
        () => {}
      );
    }
  );
  return view(function* () {
    return <i />;
  });
});
export type AttemptCallEffectView = Expect<
  Equal<ViewFailsOf<ReturnType<typeof AttemptCallEffect>>, never>
>;
// …but not one that waits
export const AttemptAsyncCallEffect = $component(function* AttemptAsyncCallEffect() {
  yield* $effect(
    function* () {},
    // @ts-expect-error an $effect does not wait: EventCallOp<true, true> is not an EffectOp
    function* () {
      yield* attempt(
        () => failing(),
        () => {}
      );
    }
  );
  return view(function* () {
    return <i />;
  });
});
// a handler that returns the call's failure on one path and nothing on another is refused
export const mixedCall = attempt(
  () => failing(),
  // @ts-expect-error [ATTEMPT_ABSORBS]
  e => (e instanceof Boom ? e : undefined)
);

// --- D-091: an $event does not attempt a stream; a stream's handler is a plain function ---
declare function feed(): AsyncIterable<number>;
declare function feedLater(): Promise<AsyncIterable<number>>;
type StreamOp = StreamAttempt & {
  readonly "[STREAM_IN_EVENT] a stream is consumed in a reactive routine: $memo or $projection": true;
};
// a stream attempt yields the stream op (with the refusal's message), and its handler's failure
export const streamTransform = attempt(
  () => feed(),
  cause => new Boom(String(cause))
);
export type StreamTransform = Expect<
  Equal<typeof streamTransform, Yieldable<StreamOp | Raise<Boom>, AsyncIterable<number> & Handled>>
>;
// absorbed: nothing ends the stream (or there was no stream: undefined)
export const streamAbsorb = attempt(
  () => feed(),
  () => {}
);
export type StreamAbsorb = Expect<
  Equal<typeof streamAbsorb, Yieldable<StreamOp, (AsyncIterable<number> & Handled) | undefined>>
>;
// a promise of a stream waits, then gives the stream back
export const streamLater = attempt(
  () => feedLater(),
  cause => new Boom(String(cause))
);
export type StreamLater = Expect<
  Equal<
    typeof streamLater,
    Yieldable<Wait | StreamOp | Raise<Boom>, AsyncIterable<number> & Handled>
  >
>;
export const StreamHosts = $component(function* StreamHosts() {
  // a reactive routine consumes a stream: a $memo returns it
  const live = yield* $memo(function* () {
    return yield* attempt(
      () => feed(),
      cause => new Boom(String(cause))
    );
  });
  type _live = Expect<Equal<typeof live, Source<number, Boom, true>>>;
  // an $event does not attempt one: a stream attempt is not an EventOp
  // @ts-expect-error [STREAM_IN_EVENT] a stream is consumed in a reactive routine
  const watchIt = $event(function* () {
    return yield* attempt(
      () => feed(),
      () => {}
    );
  });
  // … nor a promise of one
  // @ts-expect-error [STREAM_IN_EVENT]
  const watchLater = $event(function* () {
    return yield* attempt(
      () => feedLater(),
      () => {}
    );
  });
  // a promise attempt in an $event keeps its generator handler (D-078)
  const save = $event(function* () {
    return yield* attempt(flaky, function* () {
      return yield* attempt(flaky, () => {});
    });
  });
  type _save = Expect<Equal<typeof save, EventHandler<[], never, string | undefined, false, true>>>;
  void watchIt;
  void watchLater;
  return view(function* () {
    return <i>{yield* live}</i>;
  });
});
// a stream's failures arrive after the host's run: no generator handler …
export const streamGen = attempt(
  () => feed(),
  // @ts-expect-error [STREAM_HANDLER] a stream's handler is a plain function
  function* (cause) {
    return new Boom(String(cause));
  }
);
// … and no value: an Error fails the stream, nothing ends it
export const streamValue = attempt(
  () => feed(),
  // @ts-expect-error [STREAM_HANDLER]
  () => "ended"
);
// a sync attempt keeps its generator handler (D-078)
export const syncGen = attempt(
  () => 1,
  function* () {
    return yield* attempt(
      () => 2,
      () => {}
    );
  }
);
export type SyncGen = Expect<Equal<typeof syncGen, Yieldable<never, number | undefined>>>;

// --- D-090: an $effect waiting on a pending read holds no boundary --------------------------
// Its compute reads `n` (pending): the `Create<"effect">` carries no pending, so the component's
// view stays settled — only render effects (holes) notify a Loading (runtime.spec "D-090").
const effectOverPending = $effect(
  function* () {
    return yield* n;
  },
  function* () {}
);
export type EffectOverPending = Expect<
  Equal<typeof effectOverPending, Yieldable<Create<"effect", never>, void>>
>;
export const EffectWaits = $component(function* EffectWaits() {
  yield* $effect(
    function* () {
      return yield* n;
    },
    function* () {}
  );
  return view(function* () {
    return <i />;
  });
});
export type EffectWaitsSettled = Expect<
  Equal<ViewPendingOf<ReturnType<typeof EffectWaits>>, false>
>;
export const effectWaitsElement: SettledView = EffectWaits();

// --- D-088: a yield component handed to foreign code handles its own failures ------------------
// `foreign(Comp)` is the handoff's check: a component that may pend is accepted (the app's
// `Loading` shows it), one that may fail is `[FOREIGN_HANDOFF]`, the property's type naming its
// failures. Identity: it returns the component's own type.
const FSettles = $component(function* FSettles() {
  return view(function* () {
    return <i />;
  });
});
const FPends = $component(function* FPends() {
  return view(function* () {
    return <i>{yield* n}</i>;
  });
});
const FFails = $component(function* FFails() {
  const m = yield* $memo(function* () {
    yield* raise(new Boom("x"));
    return 1;
  });
  return view(function* () {
    return <i>{yield* m}</i>;
  });
});
const FHandles = $component(function* FHandles() {
  return view(function* () {
    return (
      <>
        {
          yield* Errored({
            fallback: "!",
            children: function* () {
              return <>{yield* FFails()}</>;
            }
          })
        }
      </>
    );
  });
});
export const foreignSettles = foreign(FSettles);
export const foreignPends = foreign(FPends);
export const foreignHandles = foreign(FHandles);
export type ForeignIdentity = Expect<Equal<typeof foreignPends, typeof FPends>>;
// @ts-expect-error [FOREIGN_HANDOFF] FFails may fail with Boom
export const foreignFails = foreign(FFails);
// the refusal names the failures: the property's type is the `kind`s of the component's `E`
export type ForeignNames = Expect<
  Equal<
    ForeignCheck<typeof FFails>,
    {
      readonly "[FOREIGN_HANDOFF] a yield component handed to plain Solid may fail with the failure kinds this property lists: handle them inside, or wrap it in an Errored, first": "boom";
    }
  >
>;
// a lazy component pends while its chunk loads; it fails as the loaded one does
export const foreignLazy = foreign(lazy(() => Promise.resolve({ default: FPends })));
// @ts-expect-error [FOREIGN_HANDOFF] the loaded component may fail
export const foreignLazyFails = foreign(lazy(() => Promise.resolve({ default: FFails })));
// a plain function returning an element is not a yield component: nothing to check
export const foreignPlain = foreign(() => <i />);
