/**
 * The strict rules, JSX flavor — checked by `tsc -p tsconfig.json`, never
 * executed. Every `@ts-expect-error` is a rule the editor enforces; every
 * line without one must typecheck.
 */
import {
  component,
  $effect,
  $event,
  $memo,
  $optimistic,
  $optimisticStore,
  $signal,
  $store,
  attempt,
  constant,
  createContext,
  Errored,
  For,
  Loading,
  raise,
  readStore,
  render,
  Repeat,
  Show,
  type Source,
  type Path,
  type Props,
  type View,
  type ChildView,
  type Element,
  type EventHandler,
  type Read,
  type ViewFn,
  type ViewWrapperCheck,
  lazy,
  latestOf,
  isPendingOf,
  view
} from "solid-yield";
import { h } from "solid-yield/h";

declare const root: HTMLElement;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;
declare function fetchUser(id: string): Promise<{ name: string }>;
/** Pending until its first value, and never failing (as a server border states it). */
declare const pendingUser: Source<{ name: string }, never, true>;
class NotFound extends Error {
  readonly kind = "not-found";
}

// --- setup creates; views and memos read; reads only via yield* -------------------------
export const Settled = component(function* (props: Props<{ label: string }>) {
  const [count, setCount] = yield* $signal(0);
  const [store] = yield* $store({ todos: [{ title: "a" }] });
  const doubled = yield* $memo(function* () {
    return (yield* count) * 2;
  });
  const inc = $event(function* () {
    const v = yield* setCount(c => c + 1);
    void v;
  });
  return view(function* () {
    return (
      <p onClick={yield* inc} title={yield* props.label}>
        {yield* props.label}: {yield* doubled} {yield* store.todos[0].title}{" "}
        {yield* readStore(store, s => s.todos.length)}
      </p>
    );
  });
});
export const ok1 = Settled({ label: "a" });

// $event is an action: it takes arguments and returns a promise of its result
const save = $event(function* (id: string, times: number) {
  return id.repeat(times);
});
export const saved: Promise<string | undefined> = save("a", 2);
// @ts-expect-error its arguments are typed
export const savedMissingArg = save("a");

// @ts-expect-error a setup does not read
export const ReadsInSetup = component(function* () {
  const [count] = yield* $signal(0);
  const v = yield* count;
  return view(function* () {
    return <p>{v}</p>;
  });
});
// the effect phase reads, untracked because its host is (D-083)
export const ReadsInEffectPhase = component(function* (props: Props<{ start: number }>) {
  yield* $effect(
    function* () {},
    function* () {
      void (yield* props.start);
    }
  );
  return view(function* () {
    return <p />;
  });
});
export const CreatesInView = component(function* () {
  // @ts-expect-error a view does not create
  return view(function* () {
    const [count] = yield* $signal(0);
    return <p>{yield* count}</p>;
  });
});
export const HiddenRead = component(function* () {
  const [count] = yield* $signal(0);
  return view(function* () {
    // @ts-expect-error a source is not callable: reads are `yield*`
    return <p>{count()}</p>;
  });
});
export const WritesInMemo = component(function* () {
  const [count, setCount] = yield* $signal(0);
  // @ts-expect-error a memo does not write
  const m = yield* $memo(function* () {
    yield* setCount(1);
    return yield* count;
  });
  return view(function* () {
    return <p>{yield* m}</p>;
  });
});
export const WritesInView = component(function* () {
  const [, setCount] = yield* $signal(0);
  // @ts-expect-error a view does not write
  return view(function* () {
    const n = yield* setCount(1);
    return <p>{n}</p>;
  });
});

// --- $optimistic / $optimisticStore mirror $signal / $store (D-014) ------------------------------
export const Optimistic = component(function* () {
  const [sending] = yield* $optimistic(false);
  const [list] = yield* $optimisticStore({ items: ["a"] });
  const [derived] = yield* $optimisticStore(
    function* (draft: { items: string[] }) {
      draft.items = [String(yield* sending)];
    },
    { items: [] }
  );
  // @ts-expect-error $optimistic is the scalar form: a derived optimistic value is $optimisticStore's body
  yield* $optimistic(function* () {
    return 1;
  });
  // @ts-expect-error $optimisticStore is the object-or-body form: a scalar is $optimistic
  yield* $optimisticStore(1);
  return view(function* () {
    return (
      <p>
        {String(yield* sending)} {yield* list.items[0]} {yield* derived.items[0]}
      </p>
    );
  });
});

// --- no async function* routines ---------------------------------------------------------------
// @ts-expect-error routines are function*, never async function*
export const asyncMemo = $memo(async function* () {
  return 1;
});
export const asyncInEffect = $effect(
  function* () {},
  // @ts-expect-error an effect's attempt is synchronous (Wait is not an EffectOp)
  function* () {
    yield* attempt(
      () => fetchUser("1"),
      () => new NotFound()
    );
  }
);

// --- only settled values render -------------------------------------------------------------
// pending, and nothing it reads can fail
export const Pending = component(function* (props: Props<{ id: string }>) {
  const user = yield* $memo(function* () {
    yield* props.id;
    return yield* pendingUser;
  });
  return view(function* () {
    return <h3>{(yield* user).name}</h3>;
  });
});
export const Fallible = component(function* (props: Props<{ id: string }>) {
  const user = yield* $memo(function* () {
    const id = yield* props.id;
    const u = yield* attempt(
      () => fetchUser(id),
      () => new NotFound()
    );
    if (!u.name) yield* raise(new NotFound());
    return u;
  });
  return view(function* () {
    return <h3>{(yield* user).name}</h3>;
  });
});
// A memo with a loadingValue is never pending on read (commit #0 is the value)
export const Seeded = component(function* (props: Props<{ id: string }>) {
  const user = yield* $memo(
    function* () {
      const id = yield* props.id;
      return yield* attempt(
        () => fetchUser(id),
        () => new NotFound()
      );
    },
    { loadingValue: { name: "…" } }
  );
  // never pending (commit #0 is the value); it fails as its attempt does
  const seeded: Source<{ name: string }, NotFound> = user;
  void seeded;
  return view(function* () {
    return <h3>{(yield* user).name}</h3>;
  });
});
// never pending: an Errored alone renders it
export const seededOk = Errored({
  fallback: "!",
  children: function* () {
    return <>{yield* Seeded({ id: "1" })}</>;
  }
});
const pendingView: View<true, never> = Pending({ id: "1" });
const fallibleView: View<true, NotFound> = Fallible({ id: "1" });
void [pendingView, fallibleView];

// @ts-expect-error a yield component is called, never a tag (D-062, D-067)
export const bad1 = <Pending id="1" />;
// called, its colors are its view's
const calledPending: View<true, never> = Pending({ id: "1" });
void calledPending;
// @ts-expect-error a pending view is not an element
export const bad2 = <div>{Pending({ id: "1" })}</div>;
export const ok2 = Loading({
  fallback: function* () {
    return <p>…</p>;
  },
  children: function* () {
    return <>{yield* Pending({ id: "1" })}</>;
  }
});
// the call form takes its content as a function (built inside the boundary)
export const ok3 = (
  <div>
    {Loading({
      fallback: function* () {
        return <p>…</p>;
      },
      children: function* () {
        return <>{yield* Pending({ id: "1" })}</>;
      }
    })}
  </div>
);
// @ts-expect-error Loading handles pending, not NotFound
export const bad3: View<false, never> = Loading({
  children: function* () {
    return <>{yield* Fallible({ id: "1" })}</>;
  }
});
export const ok4 = Errored({
  fallback: err => <p>{err().kind}</p>,
  children: function* () {
    return (
      <>
        {
          yield* Loading({
            fallback: function* () {
              return <p>…</p>;
            },
            children: function* () {
              return <>{yield* Fallible({ id: "1" })}</>;
            }
          })
        }
      </>
    );
  }
});

// yield* Child(props) propagates to the parent
export const Parent = component(function* () {
  return view(function* () {
    return <section>{yield* Fallible({ id: "1" })}</section>;
  });
});
// @ts-expect-error Parent inherits Fallible's pending and failures
export const bad4: View<false, never> = Parent();
export const ok5 = Errored({
  fallback: function* () {
    return <p>error</p>;
  },
  children: function* () {
    return (
      <>
        {
          yield* Loading({
            children: function* () {
              return <>{yield* Parent()}</>;
            }
          })
        }
      </>
    );
  }
});

// the root must not be pending (it may fail: re-thrown, D-033)
const ok5Root = component(function* () {
  return view(function* () {
    return <>{yield* Settled({ label: "x" })}</>;
  });
});
render(() => Settled({ label: "x" }), root);
render(ok5Root, root);
// @ts-expect-error Settled needs its props
render(Settled, root);
// @ts-expect-error the root would suspend and may fail
render(() => Parent(), root);

// --- no hidden reads in holes ------------------------------------------------------------------
export const Thunks = component(function* () {
  const [n] = yield* $signal(1);
  const [user] = yield* $signal({ name: "x" });
  return view(function* () {
    // @ts-expect-error a plain thunk is not a child: read with yield*
    const a = <div>{() => 1}</div>;
    // @ts-expect-error a source is not a child: read it with yield*
    const b = <div>{n}</div>;
    // @ts-expect-error a plain thunk is not an attribute value
    const c = <p title={() => "x"} />;
    const ok = <p title={(yield* user).name}>{yield* n}</p>;
    return [a, b, c, ok];
  });
});

// --- derivations are $memos; in JSX the hole is the yield* ----------------------------------
export const Derived = component(function* () {
  const [n] = yield* $signal(1);
  const user = pendingUser;
  const doubled = yield* $memo(function* () {
    return (yield* n) * 2;
  });
  const name = yield* $memo(function* () {
    return (yield* user).name;
  });
  const big = yield* $memo(function* () {
    return (yield* n) > 1 ? "big" : "";
  });
  return view(function* () {
    const settledChild = <div>{yield* doubled}</div>;
    // @ts-expect-error a memo is a source, not an element: read it with yield*
    const memoChild = <div>{name}</div>;
    const generatorChild = (
      <div>
        {/* @ts-expect-error a bare function* is not a JSX child (the web renderer does not drive it): the hole is a yield* */}
        {function* () {
          return yield* n;
        }}
      </div>
    );
    const asAttribute = <p title={String(yield* doubled)} class={yield* big} />;
    return [settledChild, memoChild, generatorChild, asAttribute];
  });
});
// a memo read in an attribute counts in the view: this view may be pending
export const PendingAttribute = component(function* () {
  const user = pendingUser;
  const name = yield* $memo(function* () {
    return (yield* user).name;
  });
  return view(function* () {
    return <p title={yield* name} />;
  });
});
// @ts-expect-error PendingAttribute may be pending
export const bad5: View<false, never> = PendingAttribute();

// --- row routines ---------------------------------------------------------------------------------
type Comment = { id: number; text: string; kids: Comment[] };
declare const comments: Comment[];
export const Rows = component(function* () {
  // recursive: its view's yields are spelled out (TypeScript cannot infer a
  // type its own initializer references), as a recursive component's are
  function* comment(c: Source<Comment> & { kids: Source<Comment[]>; text: Source<string> }) {
    const [open] = yield* $signal(true);
    return view(function* (): Generator<Read<false, never> | ChildView<false, never>, Element> {
      return (
        <li>
          {yield* c.text}
          {
            yield* Show({
              when: open,
              children: function* () {
                return (
                  <>
                    {
                      yield* For({
                        each: c.kids,
                        children: comment
                      })
                    }
                  </>
                );
              }
            })
          }
        </li>
      );
    });
  }
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: comments,
            children: comment
          })
        }
        {
          yield* For({
            each: comments,
            children: function* (c, i) {
              const [open, setOpen] = yield* $signal(false);
              const toggle = $event(function* () {
                yield* setOpen(o => !o);
              });
              return view(function* () {
                return (
                  <li onClick={yield* toggle}>
                    {yield* i}: {yield* c.text} {(yield* open) ? "-" : "+"}
                  </li>
                );
              });
            }
          })
        }
        {
          yield* For({
            each: comments,
            children: function* (c) {
              return view(function* () {
                return <>{yield* Settled({ label: c.text })}</>;
              });
            }
          })
        }
        {
          yield* For({
            each: comments,
            children: function* (c) {
              // a row's body is a setup (as a component's): a derivation is the row's $memo
              const shout = yield* $memo(function* () {
                return (yield* c.text).toUpperCase();
              });
              return view(function* () {
                return <li title={yield* shout}>{yield* shout}</li>;
              });
            }
          })
        }
        {
          yield* Repeat({
            count: 2,
            children: function* (i) {
              return view(function* () {
                return <b>{yield* i}</b>;
              });
            }
          })
        }
        {
          yield* For({
            each: comments,
            children: function* (c) {
              return view(function* () {
                return (
                  <li>
                    {
                      yield* Loading({
                        children: function* () {
                          return <>{yield* Pending({ id: c.text })}</>;
                        }
                      })
                    }
                  </li>
                );
              });
            }
          })
        }
      </ul>
    );
  });
});

// --- flow controls take a hole as well as a source (D-038) --------------------------------------
export const FlowHoles = component(function* () {
  const [n] = yield* $signal(1);
  const [list] = yield* $signal(["a", "b"]);
  return view(function* () {
    return (
      <div>
        {
          yield* Show({
            when: function* () {
              return (yield* n) > 1;
            },
            fallback: function* () {
              return <i>small</i>;
            },
            children: function* () {
              return <b>big</b>;
            }
          })
        }
        {
          yield* Show({
            when: function* () {
              return (yield* list)[0];
            },
            children: function* (first) {
              return view(function* () {
                return <b>{yield* first}</b>;
              });
            }
          })
        }
        {
          yield* For({
            each: function* () {
              return (yield* list).filter(x => x !== "b");
            },
            children: function* (item) {
              return view(function* () {
                return <li>{yield* item}</li>;
              });
            }
          })
        }
        {
          yield* Repeat({
            count: function* () {
              return yield* n;
            },
            children: function* (i) {
              return view(function* () {
                return <u>{yield* i}</u>;
              });
            }
          })
        }
      </div>
    );
  });
});
const pendingHole = function* () {
  return (yield* pendingUser).name;
};
// in call form a hole over a pending source colors the flow control's view
export const pendingHoleView: View<true, never> = Show({
  when: pendingHole,
  children: function* () {
    return <>!</>;
  }
});

// --- a pending row colors the holding view too (D-063) ------------------------------------------
const pendingRow = function* (c: Path<Comment>) {
  return view(function* () {
    return (
      <li>
        {
          yield* Pending({
            id: function* () {
              return String(yield* c.id);
            }
          })
        }
      </li>
    );
  });
};
export const PendingRows = component(function* () {
  return view(function* () {
    return <ul>{yield* For({ each: comments, children: pendingRow })}</ul>;
  });
});
const pendingRowsView: View<true, never> = PendingRows();
void pendingRowsView;
export const pendingRowsOk = Loading({
  fallback: "…",
  children: function* () {
    return <>{yield* PendingRows()}</>;
  }
});

// --- a row need not be settled: its failures join the view holding the list (D-059) ------------
const failingRow = function* (c: Path<Comment>) {
  const shown = yield* $memo(function* () {
    const text = yield* c.text;
    if (!text) yield* raise(new NotFound());
    return text;
  });
  return view(function* () {
    return <li>{yield* shown}</li>;
  });
};
export const FailingRows = component(function* () {
  return view(function* () {
    return <ul>{yield* For({ each: comments, children: failingRow })}</ul>;
  });
});
// a failing row colors the holding view
const failingRowsView: View<false, NotFound> = FailingRows();
void failingRowsView;
export const failingRowsOk = Errored({
  fallback: "!",
  children: function* () {
    return <>{yield* FailingRows()}</>;
  }
});
// @ts-expect-error a yield component is never a tag (D-062): a flow control is called
export const failingRowsTag = <For each={comments}>{failingRow}</For>;

// --- view(): a view's mistake is reported at the view, not at component (D-054) ----------------
export const WrappedCreates = component(function* () {
  const [n] = yield* $signal(1);
  // @ts-expect-error reported here, at the view, naming the op (Create<"signal"> is not a ViewOp)
  return view(function* () {
    const [m] = yield* $signal(0);
    return (
      <p>
        {yield* n}
        {yield* m}
      </p>
    );
  });
});
// --- D-089: one spelling of a view: a bare function* returned from a setup is refused -------------
// (before D-089 it was accepted, and a view's mistake was reported at the component( call)
// @ts-expect-error [VIEW_WRAPPER] wrap the view: return view(function* () { ... })
export const Unwrapped = component(function* () {
  return function* () {
    return <p />;
  };
});
// the refusal is the setup's own check, so TypeScript prints its message first
export type UnwrappedRefused = Expect<
  Equal<
    ViewWrapperCheck<() => Generator<never, Element, any>>,
    { readonly "[VIEW_WRAPPER] wrap the view: return view(function* () { ... })": never }
  >
>;
export type WrappedAccepted = Expect<Equal<ViewWrapperCheck<ViewFn<never, Element>>, unknown>>;
// a row's setup returns its view through view(…) too. Refused as no overload of For matching
// (the first ends "… is not assignable to type 'ViewWrapped'"), and TypeScript also reports TS2589
// ("excessively deep") at the call: not by the message. The lint `require-view-wrapper` reports
// an inline row with its message (and the autofix)
// @ts-expect-error TS2589 at the call
export const UnwrappedRow = For({
  each: comments,
  // @ts-expect-error a row's bare view lacks view's brand
  children: function* (c) {
    return function* () {
      return <li>{yield* c.text}</li>;
    };
  }
});
// a wrapped view keeps its colors
export const WrappedPending = component(function* () {
  return view(function* () {
    return <b>{(yield* pendingUser).name}</b>;
  });
});
const wrappedPendingView: View<true, never> = WrappedPending();
void wrappedPendingView;

// --- a row receives item: Source<T> (a path) and index: Source<number> (D-055) -----------------
type Is<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const RowSignature = component(function* () {
  const [list] = yield* $signal([{ id: 1, text: "a" }]);
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: list,
            children: function* (item, index) {
              const sig: [
                Is<typeof item, Path<{ id: number; text: string }>>,
                Is<typeof index, Source<number>>
              ] = [true, true];
              void sig;
              // both are sources: read with yield*, never as values
              // @ts-expect-error an item is not its value
              const text: string = item.text;
              void text;
              return view(function* () {
                return (
                  <li>
                    {yield* index}: {yield* item.text}
                  </li>
                );
              });
            }
          })
        }
        {
          yield* Repeat({
            count: 2,
            children: function* (i) {
              const sig: Is<typeof i, Source<number>> = true;
              void sig;
              return view(function* () {
                return <b>{yield* i}</b>;
              });
            }
          })
        }
      </ul>
    );
  });
});

// a row's setup does not read: derive with $memo, read in the view
const readsInRowSetup = function* (c: Path<Comment>) {
  const text = yield* c.text;
  return view(function* () {
    return <li>{text}</li>;
  });
};
// @ts-expect-error [ROW_SETUP_OP]
export const badRowSetup = For({ each: comments, children: readsInRowSetup });

// --- paths through nullable values and nested sources --------------------------------------------
export const Nullable = component(function* (props: Props<{ me: { name: string } | null }>) {
  return view(function* () {
    // through a nullable object a key may read `undefined`
    const name: Source<string | undefined> = props.me.name;
    return <b>{yield* name}</b>;
  });
});
declare const wire: { status: Source<"on" | "off", NotFound, true> };
// a key holding a source reads through it, with its coloring
export const Through = component(function* (props: Props<{ wire: typeof wire }>) {
  return view(function* () {
    const status: Source<"on" | "off", NotFound, boolean> = props.wire.status;
    return <b>{yield* status}</b>;
  });
});
// @ts-expect-error the status may be pending and fail: so may Through's view
export const bad6: View<false, never> = Through({ wire: wire });

// --- a prop declared as a source states the coloring its readers handle ----------------------------
export const Declared = component(function* (
  props: Props<{ user: Source<{ name: string }, NotFound, true> }>
) {
  return view(function* () {
    return <b>{(yield* props.user).name}</b>;
  });
});
declare const settledUser: Source<{ name: string }>;
// callers pass any source within it (a settled one too) or the value
export const ok6 = Errored({
  fallback: "!",
  children: function* () {
    return (
      <>
        {
          yield* Loading({
            children: function* () {
              return <>{yield* Declared({ user: settledUser })}</>;
            }
          })
        }
      </>
    );
  }
});
export const ok7 = Errored({
  fallback: "!",
  children: function* () {
    return (
      <>
        {
          yield* Loading({
            children: function* () {
              return <>{yield* Declared({ user: { name: "a" } })}</>;
            }
          })
        }
      </>
    );
  }
});
// @ts-expect-error a declared source's reads are pending and may fail
export const bad7: View<false, never> = Declared({ user: settledUser });

// --- a memo over a promise of a stream is the stream's values (Solid flattens one level) ---------
declare function stream(): Promise<AsyncIterable<number>>;
export const Streamed = component(function* () {
  const n = yield* $memo(function* () {
    return yield* attempt(
      () => stream(),
      () => new NotFound()
    );
  });
  // pending (a stream), failing as its attempt's handler says
  const typed: Source<number, NotFound, true> = n;
  return view(function* () {
    return <b>{yield* typed}</b>;
  });
});
export const StreamedWithoutAttempt = component(function* () {
  // @ts-expect-error a body returns a promise or a stream through attempt
  const n = yield* $memo(function* () {
    return stream();
  });
  void n;
  return view(function* () {
    return <b />;
  });
});

// --- lazy: pending while its chunk loads, and colored as the loaded component (D-047) -----------
const LazyPending = lazy(() => Promise.resolve({ default: Pending }));
// @ts-expect-error still pending: a lazy component is never a tag, and called it is pending
export const lazyBad: View<false, never> = LazyPending({ id: "1" });
export const lazyOk = Loading({
  fallback: "…",
  children: function* () {
    return <>{yield* LazyPending({ id: "1" })}</>;
  }
});
export const LazyHost = component(function* () {
  return view(function* () {
    return <div>{yield* LazyPending({ id: "1" })}</div>;
  });
});
const lazyHostView: View<true, never> = LazyHost();
void lazyHostView;
// a view rendering a loading lazy is pending, even when the loaded component is settled
const LazySettled = lazy(() => Promise.resolve({ default: Settled }));
// @ts-expect-error pending while its chunk loads
export const lazySettledBad: View<false, never> = LazySettled({ label: "x" });
export const LazySettledHost = component(function* () {
  return view(function* () {
    return <div>{yield* LazySettled({ label: "x" })}</div>;
  });
});
const lazySettledView: View<true, never> = LazySettledHost();
void lazySettledView;
// and it fails as the loaded component does
const LazyFallible = lazy(() => Promise.resolve({ default: Fallible }));
const lazyFallibleView: View<true, NotFound> = LazyFallible({ id: "1" });
void lazyFallibleView;
// the export option and preload, as Solid's lazy
const LazyNamed = lazy(() => Promise.resolve({ Settled }), { export: "Settled" });
export const lazyNamedOk = Loading({
  fallback: "…",
  children: function* () {
    return <>{yield* LazyNamed({ label: "x" })}</>;
  }
});
void LazyNamed.preload;

// --- web's serializable attribute values (the router's action(), typed paths) ------------------
declare const serializable: import("@solidjs/web").JSX.SerializableAttributeValue;
export const formAction = <form action={serializable} />;
export const linkHref = <a href={serializable} />;

// events carry two colors: P (reads pending data, and waits for it), A (async work of its own)
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Colors<H> = H extends EventHandler<any, any, any, infer P, infer A> ? [P, A] : never;
export const EventColors = component(function* () {
  const [n] = yield* $signal(1);
  const data = yield* $memo(function* () {
    const v = yield* n;
    return yield* attempt(
      () => Promise.resolve(v),
      () => new NotFound()
    );
  });
  const readsData = $event(function* () {
    return yield* data;
  });
  const requests = $event(function* () {
    yield* attempt(
      () => Promise.resolve(1),
      () => new NotFound()
    );
  });
  const callsBoth = $event(function* () {
    yield* readsData();
    yield* requests();
  });
  const sync = $event(function* () {});
  const colors: [
    Same<Colors<typeof readsData>, [true, false]>,
    Same<Colors<typeof requests>, [false, true]>,
    Same<Colors<typeof callsBoth>, [true, true]>,
    Same<Colors<typeof sync>, [false, false]>
  ] = [true, true, true, true];
  void colors;
  // an $effect does not wait: it delegates to a sync event only (an async one
  // is reached through an event calling an event, or a $memo; D-035)
  yield* $effect(
    function* () {},
    function* () {
      yield* sync();
    }
  );
  yield* $effect(
    function* () {},
    // @ts-expect-error an $effect does not wait on an event doing async work
    function* () {
      yield* requests();
    }
  );
  yield* $effect(
    function* () {},
    // @ts-expect-error nor on an event that waits for pending data
    function* () {
      yield* readsData();
    }
  );
  return view(function* () {
    return <p />;
  });
});

// each error type is its own color; an Errored with `catch` handles only the types it lists
class NotFoundE extends Error {
  readonly kind = "not-found" as const;
}
class ForbiddenE extends Error {
  readonly kind = "forbidden" as const;
}
const Fetches = component(function* () {
  const [id] = yield* $signal("1");
  const user = yield* $memo(function* () {
    const v = yield* id;
    return yield* attempt(
      () => Promise.resolve({ name: v }),
      error => (error === "forbidden" ? new ForbiddenE() : new NotFoundE())
    );
  });
  return view(function* () {
    return <p>{(yield* user).name}</p>;
  });
});
// one boundary per type: both handled, renderable
export const bothHandled = Errored({
  catch: [ForbiddenE],
  fallback: "no access",
  children: function* () {
    return (
      <>
        {
          yield* Errored({
            catch: [NotFoundE],
            fallback: err => {
              const e: NotFoundE = err();
              return <p>{e.kind}</p>;
            },
            children: function* () {
              return (
                <>
                  {
                    yield* Loading({
                      children: function* () {
                        return <>{yield* Fetches()}</>;
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
  }
});
render(() => bothHandled, root);
// only NotFound handled: ForbiddenE still fails the tree
export const partlyHandled = Errored({
  catch: [NotFoundE],
  fallback: err => <p>{err().kind}</p>,
  children: function* () {
    return (
      <>
        {
          yield* Loading({
            children: function* () {
              return <>{yield* Fetches()}</>;
            }
          })
        }
      </>
    );
  }
});
// ForbiddenE is unhandled: the tree may fail, and a failure with no boundary is re-thrown
// (D-033) — the root needs no Errored; it must not be pending (D-059, 1B)
render(() => partlyHandled, root);
export const tagHandled = Errored({
  catch: [NotFoundE, ForbiddenE],
  fallback: err => <p>{err().kind}</p>,
  children: function* () {
    return (
      <>
        {
          yield* Loading({
            children: function* () {
              return <>{yield* Fetches()}</>;
            }
          })
        }
      </>
    );
  }
});
// @ts-expect-error ForbiddenE is unhandled: the view may fail
export const tagPartly: View<false, never> = Errored({
  catch: [NotFoundE],
  fallback: err => <p>{err().kind}</p>,
  children: function* () {
    return (
      <>
        {
          yield* Loading({
            children: function* () {
              return <>{yield* Fetches()}</>;
            }
          })
        }
      </>
    );
  }
});
render(
  () =>
    // @ts-expect-error async data outside a Loading: the tree would suspend
    Errored({
      fallback: "!",
      children: function* () {
        return <>{yield* Fetches()}</>;
      }
    }),
  root
);

// --- every failure type carries a literal kind (D-034) ------------------------------------------
// two structurally identical classes would be one type to TypeScript, while
// the runtime tells them apart with instanceof: a literal kind is required
class PlainA extends Error {}
class PlainB extends Error {}
class StringKind extends Error {
  readonly kind: string = "s";
}
class KindA extends Error {
  readonly kind = "a" as const;
}
class KindB extends Error {
  readonly kind = "b" as const;
}
const one = () => 1;
const toPlainA = () => new PlainA();
const toStringKind = () => new StringKind();
export const failures = $memo(function* () {
  // @ts-expect-error an error class needs `readonly kind = "x" as const`
  yield* attempt(one, toPlainA);
  // @ts-expect-error a plain-string kind cannot tell two classes apart
  yield* attempt(one, toStringKind);
  // @ts-expect-error raise is held to the same constraint
  yield* raise(new PlainB());
  // @ts-expect-error a plain Error has no kind
  yield* raise(new Error("x"));
  yield* attempt(
    () => 1,
    e => (e === "a" ? new KindA() : new KindB())
  );
  return 1;
});
// with literal kinds a catch removes only its own class
const KindFails = component(function* () {
  const m = yield* $memo(function* () {
    return yield* attempt(
      () => Promise.resolve(1),
      e => (e === "a" ? new KindA() : new KindB())
    );
  });
  return view(function* () {
    return <b>{yield* m}</b>;
  });
});
const onlyA = Errored({
  catch: [KindA],
  fallback: "a",
  children: function* () {
    return (
      <>
        {
          yield* Loading({
            children: function* () {
              return <>{yield* KindFails()}</>;
            }
          })
        }
      </>
    );
  }
});
const stillB: View<false, KindB> = onlyA;
void stillB;
export const plainCatch = Errored({
  // @ts-expect-error a catch list needs classes with a literal kind
  catch: [PlainA],
  fallback: "!",
  children: function* () {
    return <>{yield* KindFails()}</>;
  }
});

// --- constant(value): a settled source that never fails (D-060) ---------------------------------
const nobody = constant<{ name: string } | null>(null);
const nobodyIs: Source<{ name: string } | null> = nobody;
void nobodyIs;
export const ConstantContext = createContext(constant<{ name: string } | null>(null));
export const ReadsConstant = component(function* () {
  const who = yield* ConstantContext;
  return view(function* () {
    return <b>{(yield* who)?.name ?? "nobody"}</b>;
  });
});
// settled: an element as it is
export const readsConstantOk = <div>{ReadsConstant()}</div>;

// --- the call form: tags are DOM elements and foreign components; a yield component is called,
// its props are sources, holes or values, its children a generator (D-065, D-066, D-067) --------
const Total = component(function* (props: Props<{ n: number; label: string }>) {
  return view(function* () {
    return (
      <p>
        {yield* props.label}: {yield* props.n}
      </p>
    );
  });
});
const count = constant(2);
// a value, a source, a hole: each is a prop
export const totalValue: View<false, never> = Total({ n: 1, label: "n" });
export const totalSource: View<false, never> = Total({ n: count, label: "n" });
export const totalHole = Total({
  n: function* () {
    return (yield* count) * 2;
  },
  label: "twice"
});
export const totalHoleBad = Total({
  // @ts-expect-error a hole returns the prop's type
  n: function* () {
    return "two";
  },
  label: "n"
});
// @ts-expect-error a yield component is never a tag, flow controls included (D-067)
export const showTag = <Show when={true}>{<b />}</Show>;
// a foreign (plain-Solid) component stays a tag
const Foreign = (p: { title: string; children?: Element }) => (
  <section title={p.title}>{p.children}</section>
);
export const foreignTag = (
  <Foreign title="t">
    <b />
  </Foreign>
);
// children are a lazy view (D-066): its holes are its own, its colors the call's
export const lazyChildren: View<true, never> = Show({
  when: true,
  children: function* () {
    return <>{yield* Pending({ id: "1" })}</>;
  }
});
// a fallback may be a lazy view too
export const lazyFallback: View<true, never> = Show({
  when: count,
  fallback: function* () {
    return <>{yield* Pending({ id: "2" })}</>;
  },
  children: function* () {
    return <b />;
  }
});

// --- declared prop colors (D-023, D-024, D-029, D-034, D-040, D-056, D-068) ------------------------
type Todo = { title: string; done: boolean };
class FetchError extends Error {
  readonly kind = "fetch" as const;
}
class SaveError extends Error {
  readonly kind = "save" as const;
}
/** The same shape as FetchError, its own literal kind (D-034). */
class FetchErrorTwin extends Error {
  readonly kind = "fetch-twin" as const;
}
declare const settledTodo: Source<Todo>;
declare const settledTodoPath: Path<Todo>;
declare const pendingTodo: Source<Todo, never, true>;
declare const failingTodo: Source<Todo, FetchError>;
declare const asyncTodo: Source<Todo, FetchError, true>;
declare const saveTodo: Source<Todo, SaveError, true>;
declare const twinTodo: Source<Todo, FetchErrorTwin, true>;
type ReadOf<S> = S extends { [Symbol.iterator](): Generator<infer Y, any, any> } ? Y : never;

// a bare prop is settled and never fails (D-024): its reads are Read<false, never>
const TodoItem = component(function* TodoItem(props: Props<{ todo: Todo; label: string }>) {
  const reads: [
    Is<ReadOf<typeof props.todo>, Read<false, never>>,
    Is<ReadOf<typeof props.todo.title>, Read<false, never>>
  ] = [true, true];
  void reads;
  return view(function* () {
    return (
      <li>
        {yield* props.label}: {yield* props.todo.title}
      </li>
    );
  });
});
// a prop declared Source<T, E, true> may be pending and fail: its reads are Read<true, E>
const AsyncItem = component(function* AsyncItem(
  props: Props<{ todo: Source<Todo, FetchError, true> }>
) {
  const reads: Is<ReadOf<typeof props.todo.title>, Read<true, FetchError>> = true;
  void reads;
  // latestOf / isPendingOf take a declared prop
  const latest = latestOf(props.todo);
  const refreshing = isPendingOf(props.todo);
  return view(function* () {
    return (
      <li>
        {(yield* latest).title} {String(yield* refreshing)}
      </li>
    );
  });
});
// Source<T, E> may fail, never pending; Source<T, never, true> pending, never fails
const FailingItem = component(function* (props: Props<{ todo: Source<Todo, FetchError> }>) {
  const reads: Is<ReadOf<typeof props.todo>, Read<false, FetchError>> = true;
  void reads;
  return view(function* () {
    return <li>{yield* props.todo.title}</li>;
  });
});
const PendingItem = component(function* (props: Props<{ todo: Source<Todo, never, true> }>) {
  const reads: Is<ReadOf<typeof props.todo>, Read<true, never>> = true;
  void reads;
  return view(function* () {
    return <li>{yield* props.todo.title}</li>;
  });
});
// the component's view carries its declared colors (Async is permission only, D-040)
export const asyncView: View<true, FetchError> = AsyncItem({ todo: asyncTodo });
export const failingView: View<false, FetchError> = FailingItem({ todo: failingTodo });
export const pendingItemView: View<true, never> = PendingItem({ todo: pendingTodo });
export const settledView: View<false, never> = TodoItem({ todo: settledTodo, label: "a" });

// call-site acceptance of a bare prop: a value, a settled source, a settled path, a settled hole
export const bare1 = TodoItem({ todo: { title: "a", done: false }, label: "a" });
export const bare2 = TodoItem({ todo: settledTodo, label: constant("a") });
export const bare3 = TodoItem({ todo: settledTodoPath, label: settledTodoPath.title });
export const bare4 = TodoItem({
  todo: function* () {
    return yield* settledTodo;
  },
  label: "a"
});
// … and it refuses a pending or failing source
// @ts-expect-error [SETTLED_PROP] prop `todo` is settled: a pending source
export const bareBad1 = TodoItem({ todo: pendingTodo, label: "a" });
// @ts-expect-error [SETTLED_PROP] prop `todo` is settled: a failing source
export const bareBad2 = TodoItem({ todo: failingTodo, label: "a" });
// @ts-expect-error [SETTLED_PROP] prop `todo` is settled: a pending and failing path
export const bareBad3 = TodoItem({ todo: asyncTodo, label: "a" });
// a pending hole does not pass a settled prop
export const bareBad4 = TodoItem({
  // @ts-expect-error the hole reads a pending source
  todo: function* () {
    return yield* pendingTodo;
  },
  label: "a"
});
// nor does a failing one
export const bareBad5 = TodoItem({
  // @ts-expect-error the hole reads a failing source
  todo: function* () {
    return yield* failingTodo;
  },
  label: "a"
});
export const bareBad6 = TodoItem({
  // @ts-expect-error the hole raises
  todo: function* () {
    yield* raise(new FetchError());
    return { title: "a", done: false };
  },
  label: "a"
});

// a declared Source<T, E, true> takes anything within its coloring: settled ⊂ pending, never ⊂ E
export const async1 = AsyncItem({ todo: { title: "a", done: false } });
export const async2 = AsyncItem({ todo: settledTodo });
export const async3 = AsyncItem({ todo: pendingTodo });
export const async4 = AsyncItem({ todo: failingTodo });
export const async5 = AsyncItem({ todo: asyncTodo });
export const async6 = AsyncItem({
  todo: function* () {
    return yield* asyncTodo;
  }
});
// … but not a failure it did not declare
// @ts-expect-error SaveError is not FetchError
export const asyncBad1 = AsyncItem({ todo: saveTodo });
// two error classes of one shape are two colors: their literal kinds differ (D-034)
// @ts-expect-error FetchErrorTwin is not FetchError
export const asyncBad2 = AsyncItem({ todo: twinTodo });
// a prop declared sync (Source<T, E>) refuses a pending source
// @ts-expect-error Source<Todo, FetchError> is never pending
export const failingBad = FailingItem({ todo: asyncTodo });
// a prop declared pending-never-failing refuses a failing source
// @ts-expect-error Source<Todo, never, true> never fails
export const pendingBad = PendingItem({ todo: asyncTodo });

// a declared failure is a Failure with a literal kind (D-034)
class Untagged extends Error {}
class LooseKind extends Error {
  readonly kind: string = "loose";
}
// @ts-expect-error [FAILURE_KIND] Untagged has no literal kind
export type UntaggedProps = Props<{ todo: Source<Todo, Untagged, true> }>;
// @ts-expect-error [FAILURE_KIND] a plain string kind
export type LooseProps = Props<{ todo: Source<Todo, LooseKind, true> }>;
// @ts-expect-error [FAILURE_KIND] unknown is not a failure type
export type UnknownProps = Props<{ todo: Source<Todo, unknown, true> }>;

// a pass-through component declares its color with type parameters (D-029):
// the body is checked once for every color, and its view carries each caller's
const Card = component(function* Card<E, P extends boolean>(
  props: Props<{ todo: Source<Todo, E, P>; label: string }>
) {
  return view(function* () {
    return <section>{yield* AsyncThrough({ todo: props.todo })}</section>;
  });
});
const AsyncThrough = component(function* <E, P extends boolean>(
  props: Props<{ todo: Source<Todo, E, P> }>
) {
  return view(function* () {
    return <p>{yield* props.todo.title}</p>;
  });
});
export const cardSettled: View<false, never> = Card({ todo: settledTodo, label: "a" });
export const cardAsync: View<true, FetchError> = Card({ todo: asyncTodo, label: "a" });
// the component keeps its type parameters (D-068: a plain function type)
type CardOut = ReturnType<typeof Card<FetchError, true>>;
type ColorsOfView<V> = V extends View<infer P, infer E> ? [P, E] : never;
export const cardColors: Is<ColorsOfView<CardOut>, [true, FetchError]> = true;
// @ts-expect-error the caller's colors: a pending, failing Card is not settled
export const cardBad: View<false, never> = Card({ todo: asyncTodo, label: "a" });
// forwarding into a bare (settled) prop is an error: the body is checked for every color
export const ForwardsToBare = component(function* <E, P extends boolean>(
  props: Props<{ todo: Source<Todo, E, P> }>
) {
  return view(function* () {
    // @ts-expect-error TodoItem's todo is settled; the forwarded prop may be pending or fail
    return <ul>{yield* TodoItem({ todo: props.todo, label: "a" })}</ul>;
  });
});
// forwarding into a declared prop that takes the color compiles
export const ForwardsToAsync = component(function* <P extends boolean>(
  props: Props<{ todo: Source<Todo, FetchError, P> }>
) {
  return view(function* () {
    return <ul>{yield* AsyncItem({ todo: props.todo })}</ul>;
  });
});

// a declared prop's failure needs no boundary at any position (D-059, D-033): it joins the
// holding view — a row's, a call's in a hole — and is re-thrown at the root with no Errored
declare const asyncTodos: Source<Todo[]>;
export const InRows = component(function* () {
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: asyncTodos,
            children: function* (todo) {
              return view(function* () {
                return (
                  <>
                    {
                      yield* FailingItem({
                        todo: function* () {
                          return yield* todo;
                        }
                      })
                    }
                  </>
                );
              });
            }
          })
        }
      </ul>
    );
  });
});
export const inRowsColors: View<false, FetchError> = InRows();
render(InRows, root);
// only pending needs a position that admits it
// @ts-expect-error the root would suspend
render(() => AsyncItem({ todo: asyncTodo }), root);
render(
  () =>
    Loading({
      children: function* () {
        return <>{yield* AsyncItem({ todo: asyncTodo })}</>;
      }
    }),
  root
);

// a prop that may be undefined takes a hole returning undefined; with every prop optional the
// props object is too
const Note = component(function* (props: Props<{ note?: string; children: Element }>) {
  return view(function* () {
    return (
      <p>
        {yield* props.note}
        {yield* props.children}
      </p>
    );
  });
});
export const noteHole = Note({
  note: function* () {
    return undefined;
  },
  children: function* () {
    return undefined;
  }
});
const OnlyOptional = component(function* (props: Props<{ note?: string }>) {
  return view(function* () {
    return <p>{yield* props.note}</p>;
  });
});
export const onlyOptional = OnlyOptional();

// --- D-086: an unyielded component call in a fragment is refused ------------------------------------
// A fragment's children are elements, as an element's are (with `jsxFactory` / `jsxFragmentFactory`
// in the tsconfig: TypeScript checks a fragment only then). Not delegated to, a pending, failing
// view's colors would reach no type.
declare const unsettled: Source<string, NotFound, true>;
const Unsettled = component(function* Unsettled(
  props: Props<{ u: Source<string, NotFound, true> }>
) {
  return view(function* () {
    return <p>{yield* props.u}</p>;
  });
});
export const UnyieldedInFragment = component(function* () {
  return view(function* () {
    return (
      // @ts-expect-error an unyielded call in a fragment is refused: the view is pending and fails
      <>{Unsettled({ u: unsettled })}</>
    );
  });
});
export const UnyieldedArrayInFragment = component(function* () {
  return view(function* () {
    return (
      // @ts-expect-error … in an array in a fragment too (the todos twin's shape, review R2)
      <>{[Unsettled({ u: unsettled }), Unsettled({ u: unsettled })]}</>
    );
  });
});
// delegated to, the call's colors are the view's
export const YieldedInFragment = component(function* () {
  return view(function* () {
    return <>{yield* Unsettled({ u: unsettled })}</>;
  });
});
export type YieldedInFragmentView =
  ReturnType<typeof YieldedInFragment> extends View<true, NotFound> ? true : never;
export const yieldedInFragmentView: YieldedInFragmentView = true;
// a settled call in a fragment is an element (a JSX element child, text and an array of them too)
const SettledCall = component(function* SettledCall() {
  return view(function* () {
    return <i />;
  });
});
export const SettledInFragment = component(function* () {
  return view(function* () {
    return (
      <>
        {SettledCall()}
        text {[<b />, "s"]}
      </>
    );
  });
});

// --- D-094: fallback and children are lazy views; a JSX element there is refused ---------------
// A JSX element written in the call is built with the holding view, shown or not (D-066; a
// fallback's build is the twins' hydration key miss, D-092). `h` output (`HView`, h's own branded
// subtype of Element) and text are built where they are inserted, and pass.
export const JsxFallbackRefused = Loading({
  // @ts-expect-error [LAZY_VIEW] fallback is a lazy view: function* () { return <.../>; }
  fallback: <p>…</p>,
  children: function* () {
    return <>{yield* Pending({ id: "1" })}</>;
  }
});
export const JsxFragmentFallbackRefused = Show({
  when: true,
  // @ts-expect-error a fragment too
  fallback: <>no</>,
  children: function* () {
    return <b>yes</b>;
  }
});
export const JsxErroredFallbackRefused = Errored({
  // @ts-expect-error Errored's: no overload takes a JSX element (the last one prints [LAZY_VIEW])
  fallback: <p>failed</p>,
  children: function* () {
    return <>{yield* Fallible({ id: "1" })}</>;
  }
});
export const JsxChildrenRefused = Loading({
  fallback: "…",
  // @ts-expect-error [LAZY_VIEW] children is a lazy view: function* () { return <.../>; }
  children: <p>content</p>
});
// @ts-expect-error a flow control's too (reported as no overload of Show matching)
export const JsxShowChildrenRefused = Show({ when: true, children: <p>content</p> });
export const JsxRenderArrowRefused = For({
  each: comments,
  // @ts-expect-error a render callback returning JSX is a second spelling of a row (I-5)
  children: c => <li>{String(c)}</li>
});
// a component's view built in the call (its setup ran in the caller) is not content either
export const BuiltViewRefused = Loading({
  // @ts-expect-error a built view: children: function* () { return <>{yield* Pending(…)}</>; }
  children: Pending({ id: "1" })
});
// the lazy view, written as a generator: accepted, and its colors are carried
export const GeneratorAccepted = Loading({
  fallback: function* () {
    return <p class="loader">…</p>;
  },
  children: function* () {
    return <>{yield* Pending({ id: "1" })}</>;
  }
});
const generatorAcceptedView: View<false, never> = GeneratorAccepted;
void generatorAcceptedView;
export const GeneratorFallbackColors = Loading({
  fallback: function* () {
    return <p>{yield* Fallible({ id: "1" })}</p>;
  },
  children: "settled"
});
// @ts-expect-error a lazy-view fallback's failure is not this Loading's to handle (D-071)
export const generatorFallbackColors: View<boolean, never> = GeneratorFallbackColors;
// h output, text and an Errored render function returning JSX (called when it shows): accepted;
// the render function carries no colors, Errored handles the failure and passes the pending on
export const HOutputAccepted = Loading({
  fallback: h("p", { class: "loader" }, "…"),
  children: h("b", "content")
});
export const TextAccepted = Show({ when: true, fallback: "no", children: "yes" });
export const RenderFunctionAccepted = Errored({
  fallback: err => <p>{err().kind}</p>,
  children: function* () {
    return <>{yield* Fallible({ id: "1" })}</>;
  }
});
const renderFunctionAcceptedView: View<true, never> = RenderFunctionAccepted;
void renderFunctionAcceptedView;
// the h form: a JSX fallback is refused there too, with the message
// @ts-expect-error [LAZY_VIEW] fallback is a lazy view (the h overloads' last one prints it)
export const HFormJsxFallback = h(Loading, { fallback: <p>…</p> }, "x");
export const HFormHFallback = h(Loading, { fallback: h("p", "…") }, "x");
// the message, pinned: what a JSX element meets in a fallback
type LoadingFallbackSlot = NonNullable<Parameters<typeof Loading>[0]["fallback"]>;
export type LazyViewMessagePinned = Expect<
  Equal<
    [
      Extract<
        LoadingFallbackSlot,
        {
          readonly "[LAZY_VIEW] fallback is a lazy view: function* () { return <.../>; }": never;
        }
      >
    ] extends [never]
      ? false
      : true,
    true
  >
>;
