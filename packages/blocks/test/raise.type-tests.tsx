/**
 * Type tests for `raise` at every host (Phase 4 item 2; raise.spec.tsx is
 * the runtime half). Each position pins what `FailsOf` makes of a raised
 * `Boom`: where it lands in a type, or that it lands nowhere. Exact types,
 * not assignability: `Expect<Equal<A, B>>`. Type-checked by `test-types`.
 */
import {
  $component,
  $effect,
  $event,
  $memo,
  $settled,
  $signal,
  For,
  raise,
  Show,
  view,
  type EventHandler,
  type FailsOf,
  type Props,
  type Raise,
  type Source,
  type View
} from "solid-blocks";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
/** A view's failures (its second color). */
type ViewFailsOf<V> = V extends View<boolean, infer E> ? E : never;
/** A view's pending flag (its first color). */
type ViewPendingOf<V> = V extends View<infer P, unknown> ? P : never;

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

// --- effect: the raise is accepted, and lands in no type (D-070) -----------------------------
// `$effect` / `$settled` give `Yieldable<Create<…>, void>`: what the body raises is not in
// the setup's yield union, so the component's view is `View<false, never>` though its
// effect fails at run time (to the nearest Errored, or re-thrown; raise.spec.tsx).
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
export type EffectView = Expect<Equal<ViewFailsOf<ReturnType<typeof Effect>>, never>>;

// --- event: the handler's type carries it; a DOM dispatch drops it (D-070) -------------------
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
      <button onClick={go} onDblClick={outer}>
        go
      </button>
    );
  });
});
// …but an `onClick` takes it as a value: the view does not carry Boom
export type EventView = Expect<Equal<ViewFailsOf<ReturnType<typeof Event>>, never>>;

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
