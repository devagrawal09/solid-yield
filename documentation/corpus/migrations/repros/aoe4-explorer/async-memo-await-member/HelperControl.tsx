import { createMemo } from "solid-js";
async function load() {
  const r = await fetch("/x");
  return r.text();
}
export function R9() {
  const b = createMemo(() => load());
  return <main>{b()}</main>;
}
