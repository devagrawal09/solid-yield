import { renderToString } from "solid-yield";
import { Shell } from "./shell";
// The original browser-only mock API needs deterministic server adapters.
// Its promises are still pending for the string render, so Loading is visible.
export function render() {
  Object.assign(globalThis, {
    location: { hash: "" },
    localStorage: { getItem: () => "[]", setItem: () => {} }
  });
  return renderToString(Shell);
}
