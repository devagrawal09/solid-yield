import { createContext, createEffect, createSignal, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
type Toc = { headings: () => string[]; add(label: string): string };
const TocContext = createContext<Toc>({ headings: () => [], add: () => "" });
export function NamedProvider(props: { children?: JSX.Element }) {
  const [headings, setHeadings] = createSignal<string[]>([]);
  let current: string[] = [];
  function add(label: string) {
    current = current.concat(label);
    setHeadings(current);
    return label;
  }
  return <TocContext value={{ headings, add }}>{props.children}</TocContext>;
}
export function Anchor(props: { label: string }) {
  const { add } = useContext(TocContext);
  const [id, setId] = createSignal("");
  createEffect(
    () => props.label,
    (label) => {
      setId(add(label));
    }
  );
  return <a id={id()} />;
}
