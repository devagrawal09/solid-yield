/*
 * The automatic JSX runtime (`jsx` / `jsxs` / `Fragment`) for code that is
 * not compiled by Solid's JSX transform (TypeScript's `react-jsx` emit, a
 * test calling `jsx(App, {})`): built on this library's `h`, so a thunk
 * builds once where it is written and `render(() => jsx(App, {}), root)`
 * behaves like `render(App, root)`.
 */
import { h } from "@solidjs/blocks/h";

export function jsx(type: any, props: any): any {
  if (props == null) return (h as any)(type);
  const { children, ...rest } = props;
  if (typeof type === "function") return (h as any)(type, props);
  return children === undefined
    ? (h as any)(type, rest)
    : (h as any)(type, rest, ...(Array.isArray(children) ? children : [children]));
}
export { jsx as jsxs, jsx as jsxDEV };
export const Fragment = (props: { children?: unknown }): unknown => props.children;
