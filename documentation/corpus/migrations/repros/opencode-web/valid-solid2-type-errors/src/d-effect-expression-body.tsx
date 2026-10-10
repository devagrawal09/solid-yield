import { createEffect, createSignal } from "solid-js";
const sink = { push(_v: number): void {} };
// Effect apply phase with an expression body returning void.
export function D() {
  const [n] = createSignal(1);
  createEffect(() => n(), (v) => sink.push(v));
  return <p>{n()}</p>;
}
