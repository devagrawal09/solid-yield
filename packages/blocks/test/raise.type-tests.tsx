/**
 * Type tests for `raise` at every host (Phase 4 item 2; raise.spec.tsx is
 * the runtime half). Each position pins what `FailsOf` makes of a raised
 * `Boom`: where it lands in a type, or that it lands nowhere. Exact types,
 * not assignability: `Expect<Equal<A, B>>`. Type-checked by `test-types`.
 */
import {
  attempt,
  $component,
  $effect,
  $event,
  $memo,
  $settled,
  $signal,
  Errored,
  For,
  raise,
  Show,
  view,
  type Bind,
  type BoundEvent,
  type Create,
  type EventHandler,
  type HView,
  type Path,
  type Reset,
  type FailsOf,
  type Props,
  type Raise,
  type Source,
  type SettledView,
  type View,
  type Wait,
  type Yieldable
} from "solid-blocks";
import { h } from "solid-blocks/h";

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
  yield* $effect(function* () {
    yield* raise(new Boom());
  });
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
  yield* $effect(function* () {
    const v = yield* attempt(
      () => JSON.parse("{") as unknown,
      () => {}
    );
    type _v = Expect<Equal<typeof v, unknown>>;
  });
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
  yield* $effect(function* () {
    yield* attempt(
      () => JSON.parse("{") as unknown,
      cause => new Boom(String(cause))
    );
  });
  return view(function* () {
    return <i />;
  });
});
export type EffectAttemptView = Expect<Equal<ViewFailsOf<ReturnType<typeof EffectAttempt>>, Boom>>;
// D-076: a handler returns the failure (an Error with a literal kind) or nothing, never both
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
// …and returns nothing else: a value is not a failure, nor nothing
export const valueHandler = attempt(
  () => 1,
  // @ts-expect-error a handler returns an Error or nothing (use `?? 0` for a fallback)
  () => 0
);
export const nullHandler = attempt(
  () => 1,
  // @ts-expect-error null is a value, not nothing
  () => null
);
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
// an effect delegating to a synchronous event that fails joins the event's failure
export const EffectCalls = $component(function* EffectCalls() {
  const fail = $event(function* () {
    yield* raise(new Other());
  });
  yield* $effect(function* () {
    yield* fail();
  });
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
              yield* $effect(function* () {
                yield* raise(new Boom());
              });
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
// failure reaches the nearest Errored above the handler's creation site
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

// --- an event attribute takes a bound block event handler, nothing else (D-072) ---------------
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
