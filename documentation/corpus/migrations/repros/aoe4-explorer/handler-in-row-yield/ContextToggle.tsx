import { createContext, createSignal, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
type Tree = { isOpen: () => boolean; toggle: () => void };
const TreeContext = createContext<Tree>({ isOpen: () => false, toggle: () => {} });
export function Group(props: { children?: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  return <TreeContext value={{ isOpen: open, toggle: () => setOpen((x) => !x) }}>{props.children}</TreeContext>;
}
// A named handler (top level, not in a row) calling a context-provided writer.
export function Toggle() {
  const { isOpen, toggle } = useContext(TreeContext);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key == "ArrowLeft" && isOpen()) toggle();
  };
  return <button onKeyDown={onKeyDown}>{isOpen() ? "-" : "+"}</button>;
}
