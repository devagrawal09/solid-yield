import { createContext, createSignal, useContext } from "solid-js";
import type { JSX } from "@solidjs/web";
type Toc = { headings: () => string[]; add(label: string): string };
const TocContext = createContext<Toc>({ headings: () => [], add: () => "" });
export function TocProvider(props: { children?: JSX.Element }) {
  const [headings, setHeadings] = createSignal<string[]>([]);
  const value: Toc = {
    headings,
    add: (label) => {
      // reads the committed list: in Solid 2 a second add() in the same flush overwrites the first (a real bug)
      setHeadings(headings().concat(label));
      return label;
    },
  };
  return <TocContext value={value}>{props.children}</TocContext>;
}
export function useToc() {
  return useContext(TocContext);
}
