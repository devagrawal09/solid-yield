/*
 * Mounting: the root edge (D-095). The root must not be pending — every
 * pending read handled by a `Loading` above it. It may fail: a failure with
 * no `Errored` above it is re-thrown (D-033), at the root as anywhere
 * (D-059), so no boundary is required for it. The root is not a hand-off to
 * foreign code: `foreign()` (D-088) is for plain Solid that takes a
 * component (the router, `@solidjs/web`'s own `render`, Solid's `lazy`).
 * Every form behaves the same:
 * `render(App, root)`, `render(() => <App />, root)`,
 * `render(() => jsx(App, {}), root)` and `render(() => h(App), root)`.
 * Those are the library's forms: an element thunk is recognised by the
 * library's own mark (`solid-yield/h`, and `solid-yield/jsx-runtime` built
 * on it); a raw `@solidjs/h` thunk is not a root (its type is not one, and
 * nothing public tells it apart from any function; D-004, D-095).
 */
import { render as webRender, hydrate as webHydrate } from "@solidjs/web";
import { ELEMENT_MARK } from "./runtime.js";
import type { Element } from "./element.js";
import type { View } from "./types.js";
import type { ContextNames } from "./context.js";

/**
 * A root that is not pending; its failures, if any, are re-thrown (D-033).
 * It requires no context (D-098): `RootCheck` names any it still does.
 */
type Root = (() => View<false, any, boolean, any>) | (() => Element);
/** What a root still requires (D-098). */
type RootRequires<C> = C extends () => infer V
  ? 0 extends 1 & V
    ? never
    : V extends View<any, any, any, infer R>
      ? R
      : never
  : never;
/**
 * The refusal of a root that requires a context (D-098), naming each: a
 * requirement no provider above discharged has nowhere left to be given.
 */
export type RootCheck<C> = [RootRequires<C>] extends [never]
  ? unknown
  : {
      readonly "[NO_PROVIDER] the root requires the contexts this property names: provide each above the components that read it (Ctx.provide({ value, children }) around their calls)": ContextNames<
        RootRequires<C>
      >;
    };
type MountableElement = Element & globalThis.Element;

/** Whether a value is `solid-yield/h` / automatic-`jsx` output: the library's mark. */
function isElementThunk(value: unknown): value is () => unknown {
  return typeof value === "function" && (value as any)[ELEMENT_MARK] === true;
}

/**
 * Build the root where the root is written. `render(code)` calls `code`
 * once, outside any effect, then inserts what it returned. Compiled JSX
 * builds its component there; an `h` / `jsx` thunk would instead be built
 * inside the insert's effect, which also reads what it built — so a root
 * whose output changes (a `Loading` or a `Show` at the top) re-ran the thunk and created the app again, resetting
 * its state. Building the thunk here makes the thunk forms behave like
 * `render(App, root)`.
 */
function rootOf(code: () => unknown): () => unknown {
  return () => {
    let tree = code();
    while (isElementThunk(tree)) tree = tree();
    return tree;
  };
}

/** Mount a root that is not pending and requires no context. */
export function render<C extends Root>(
  code: C & RootCheck<C>,
  element: MountableElement | Document | ShadowRoot | DocumentFragment | HTMLElement,
  init?: Element,
  options?: Parameters<typeof webRender>[3]
): () => void {
  return webRender(rootOf(code) as any, element as any, init as any, options);
}

/** Hydrate a root (not pending, requiring no context) rendered on the server. */
export function hydrate<C extends Root>(
  code: C & RootCheck<C>,
  element: MountableElement | Document | HTMLElement,
  options?: Parameters<typeof webHydrate>[2]
): () => void {
  return webHydrate(rootOf(code) as any, element as any, options as any);
}
