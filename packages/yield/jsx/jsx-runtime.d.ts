// `jsxImportSource: "solid-yield"`: the JSX namespace (settled-only
// `JSX.Element`, see src/element.ts) and the automatic runtime's functions.
import type { JSX } from "./jsx.js";
export { JSX } from "./jsx.js";
export function jsx(type: any, props: any): any;
export { jsx as jsxs, jsx as jsxDEV };
/**
 * D-086: a fragment's children are elements, as an element's are, so an
 * unyielded component call (`<>{Card({ todo })}</>`) is refused like it is in a
 * `<div>`. TypeScript checks a fragment against this only when the tsconfig
 * sets `jsxFactory` and `jsxFragmentFactory` (with `jsxImportSource`), and
 * only finds it as a `const`.
 */
export const Fragment: (props: { children?: JSX.Element }) => JSX.Element;
