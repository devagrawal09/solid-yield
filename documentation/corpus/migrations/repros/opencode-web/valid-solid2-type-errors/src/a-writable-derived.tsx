import { createSignal } from "solid-js";
// Solid 2 writable derived signal (function form of createSignal).
export function A(props: { initial: string }) {
  const [value, setValue] = createSignal(() => props.initial);
  return <input value={value()} onInput={(e) => setValue(e.currentTarget.value)} />;
}
