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
 * library's own mark (`solid-blocks/h`, and `solid-blocks/jsx-runtime` built
 * on it); a raw `@solidjs/h` thunk is not a root (its type is not one, and
 * nothing public tells it apart from any function; D-004, D-095).
 */
import { render as webRender, hydrate as webHydrate } from "@solidjs/web";
import { ELEMENT_MARK } from "./runtime.js";
import type { Element } from "./element.js";
import type { View } from "./types.js";

/** A root that is not pending; its failures, if any, are re-thrown (D-033). */
type Root = (() => View<false, any>) | (() => Element);
type MountableElement = Element & globalThis.Element;

/** Whether a value is `solid-blocks/h` / automatic-`jsx` output: the library's mark. */
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

/** Mount a root that is not pending. */
export function render(
  code: Root,
  element: MountableElement | Document | ShadowRoot | DocumentFragment | HTMLElement,
  init?: Element,
  options?: Parameters<typeof webRender>[3]
): () => void {
  return webRender(rootOf(code) as any, element as any, init as any, options);
}

/** Hydrate a root (not pending) rendered on the server. */
export function hydrate(
  code: Root,
  element: MountableElement | Document | HTMLElement,
  options?: Parameters<typeof webHydrate>[2]
): () => void {
  return webHydrate(rootOf(code) as any, element as any, options as any);
}
