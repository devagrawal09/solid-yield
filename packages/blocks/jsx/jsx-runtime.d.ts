// `jsxImportSource: "solid-blocks"`: the JSX namespace (settled-only
// `JSX.Element`, see src/element.ts) and the automatic runtime's functions.
export { JSX } from "./jsx.js";
export function jsx(type: any, props: any): any;
export { jsx as jsxs, jsx as jsxDEV };
export function Fragment(props: { children?: unknown }): unknown;
