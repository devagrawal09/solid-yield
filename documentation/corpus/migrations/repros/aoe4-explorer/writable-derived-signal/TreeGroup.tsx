import { createSignal } from "solid-js";
// Solid 2 writable derived signal (cheatsheet "Writable derived"): resets when props.isOpen changes.
export function TreeGroup(props: { isOpen: boolean }) {
  const [isOpen, setIsOpen] = createSignal(() => props.isOpen);
  return <button onClick={() => setIsOpen((x) => !x)}>{isOpen() ? "open" : "closed"}</button>;
}
