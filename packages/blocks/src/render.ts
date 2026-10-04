/*
 * Mounting: the root must not be pending — every pending read handled by a
 * `Loading` above it. It may fail: a failure with no `Errored` above it is
 * re-thrown (D-033), at the root as anywhere (D-059), so no boundary is
 * required for it. Every form behaves the same:
 * `render(App, root)`, `render(() => <App />, root)`,
 * `render(() => jsx(App, {}), root)` and `render(() => h(App), root)`.
 */
import { render as webRender, hydrate as webHydrate } from "@solidjs/web";
import type { Element } from "./element.js";
import type { View } from "./types.js";

/** A root that is not pending; its failures, if any, are re-thrown (D-033). */
type Root = (() => View<false, any>) | (() => Element);
type MountableElement = Element & globalThis.Element;

/** Whether a value is an `h` / automatic-`jsx` element thunk (Solid's `h` brands them). */
function isElementThunk(value: unknown): value is () => unknown {
  if (typeof value !== "function" || value.length !== 0) return false;
  const symbols = Object.getOwnPropertySymbols(value);
  for (let i = 0; i < symbols.length; i++)
    if (symbols[i].description === "hyper-element") return true;
  return false;
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
