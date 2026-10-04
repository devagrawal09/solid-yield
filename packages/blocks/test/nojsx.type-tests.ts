/**
 * The strict rules, no-JSX flavor (`h`) — checked by `tsc`, never
 * executed.
 */
import {
  $component,
  $event,
  $memo,
  $signal,
  attempt,
  For,
  Loading,
  render,
  Show,
  type HView,
  type Path,
  type Props,
  type View,
  type Source,
  view
} from "solid-blocks";
import { h } from "solid-blocks/h";

declare const root: HTMLElement;
declare function fetchUser(): Promise<{ name: string }>;
/** Pending until its first value, and never failing (as a server border states it). */
declare const pendingUser: Source<{ name: string }, never, true>;

export const Settled = $component(function* () {
  const [n] = yield* $signal(1);
  const doubled = yield* $memo(function* () {
    return (yield* n) * 2;
  });
  const go = $event(function* () {});
  return function* () {
    return h("p", { class: doubled, title: "static", onClick: go }, "count ", n, " ", function* () {
      return (yield* n) + 1;
    });
  };
});
const settledOut: HView<false, never> = h("p", "x");
void settledOut;

// tag and attribute names are typed (h)
// @ts-expect-error not an element
export const badTag = h("dvi");
// @ts-expect-error not an attribute of <a>
export const badAttr = h("a", { hreff: "/" });
// @ts-expect-error href is a string
export const badValue = h("a", { href: 5 });

// no hidden reads in holes: plain thunks are not holes
// @ts-expect-error a plain thunk child
export const thunkChild = h("p", () => 1);
// @ts-expect-error a plain thunk attribute
export const thunkAttr = h("p", { title: () => "x" });

// a view does not read (D-032): a no-JSX view yields nothing
// @ts-expect-error [HVIEW_READ]
export const ReadsInView = $component(function* () {
  const [n] = yield* $signal(1);
  return function* () {
    const v = yield* n;
    return h("p", String(v));
  };
});
// a child view is h(Child, props), not a yield* in the view
// @ts-expect-error [HVIEW_READ]
export const YieldsChild = $component(function* () {
  return function* () {
    return h("div", yield* ReadsInView());
  };
});

// pending holes make the output (and so the view) pending
export const Pending = $component(function* () {
  const user = pendingUser;
  return function* () {
    return h("p", function* () {
      return (yield* user).name;
    });
  };
});
const pendingOut: HView<true, never> = h("p", Pending());
void pendingOut;
// @ts-expect-error the root would suspend
render(() => Pending(), root);
render(() => Loading({ children: Pending() }), root);
export const handled = h("div", Loading({ fallback: "…", children: Pending() }));
const handledOut: HView<false, never> = handled;
void handledOut;
// a fragment, h([a, b]), carries its holes' pending
const fragmentOut: HView<true, never> = h([h("i", "x"), h(Pending, {})]);
void fragmentOut;
// @ts-expect-error a pending fragment is not settled
const fragmentSettled: HView<false, never> = h([h("i", "x"), h(Pending, {})]);
void fragmentSettled;

// row blocks in h
export const Rows = $component(function* () {
  const [items] = yield* $signal(["a"]);
  return function* () {
    return h(
      "ul",
      For({
        each: items,
        children: function* (item) {
          const [open] = yield* $signal(false);
          return function* () {
            return h("li", item, open);
          };
        }
      })
    );
  };
});

// a flow control's source may be a bare function* hole: the output carries its coloring
const shownPending: View<true, never> = Show({
  when: function* () {
    return (yield* pendingUser).name;
  },
  children: h("b", "x")
});
void shownPending;
// @ts-expect-error a hole over a pending source is pending
const shownSettled: HView<false, never> = Show({
  when: function* () {
    return (yield* pendingUser).name;
  },
  children: h("b", "x")
});
void shownSettled;
// settled: a settled hole and settled rows (a view, as the JSX form gives)
const listedSettled: View<false, never> = For({
  each: function* () {
    return [1, 2];
  },
  children: i => h("i", i)
});
void listedSettled;

// view() holds an h view to the no-body rule where it is written (D-054)
export const WrappedReads = $component(function* () {
  const [n] = yield* $signal(1);
  // @ts-expect-error [HVIEW_READ] at the view
  return view(function* () {
    return h("p", String(yield* n));
  });
});

// the h form's row signature is the JSX form's (D-055)
type Is<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const HRowSignature = $component(function* () {
  const [list] = yield* $signal([{ id: 1 }]);
  return function* () {
    return For({
      each: list,
      children: function* (item, index) {
        const sig: [Is<typeof item, Path<{ id: number }>>, Is<typeof index, Source<number>>] = [
          true,
          true
        ];
        void sig;
        return function* () {
          return h("li", item.id, index);
        };
      }
    });
  };
});

// --- declared prop colors at h(Comp, props) (D-024, D-029, D-068) ------------------------------
class FetchError extends Error {
  readonly kind = "fetch" as const;
}
type Todo = { title: string };
declare const settledTodo: Source<Todo>;
declare const asyncTodo: Source<Todo, FetchError, true>;
const Item = $component(function* (props: Props<{ todo: Todo }>) {
  return view(function* () {
    return h("li", props.todo.title);
  });
});
const AsyncItem = $component(function* (props: Props<{ todo: Source<Todo, FetchError, true> }>) {
  return view(function* () {
    return h("li", props.todo.title);
  });
});
const Through = $component(function* <E, P extends boolean>(
  props: Props<{ todo: Source<Todo, E, P> }>
) {
  return view(function* () {
    // a generic component is called in an h view: h(Comp, props) reads Comp's return type,
    // which TypeScript erases to its constraints for a generic function
    return h("ul", AsyncItemOf({ todo: props.todo }));
  });
});
const AsyncItemOf = $component(function* <E, P extends boolean>(
  props: Props<{ todo: Source<Todo, E, P> }>
) {
  return view(function* () {
    return h("li", props.todo.title);
  });
});
export const hSettled: HView<false, never> = h("ul", h(Item, { todo: settledTodo }));
// @ts-expect-error [SETTLED_PROP] Item's todo is settled
export const hBad = h("ul", h(Item, { todo: asyncTodo }));
export const hAsync: HView<true, FetchError> = h("ul", h(AsyncItem, { todo: asyncTodo }));
export const hAsyncSettled = h("ul", h(AsyncItem, { todo: settledTodo }));
// a pass-through component keeps its type parameters through h
export const hThrough: View<true, FetchError> = Through({ todo: asyncTodo });
export const hThroughSettled: View<false, never> = Through({ todo: settledTodo });
// children given in the props object are checked like any prop
const Shows = $component(function* (props: Props<{ children: number }>) {
  return view(function* () {
    return h("b", props.children);
  });
});
declare const pendingCount: Source<number, FetchError, true>;
export const hChildrenOk = h(Shows, { children: 1 });
// @ts-expect-error [SETTLED_PROP] Shows' children are settled
export const hChildrenBad = h(Shows, { children: pendingCount });

// --- an event attribute takes an $event handler, bound by h (D-072) -----------------------------
export const PlainHandler = $component(function* () {
  return function* () {
    // @ts-expect-error a plain function: the DOM would call it with its colors in no type (D-071)
    return h("button", { onClick: () => {} }, "go");
  };
});
