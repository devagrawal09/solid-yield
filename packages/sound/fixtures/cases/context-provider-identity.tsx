import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
const A = createContext<{ value: Accessor<number> }>({ value: () => 0 });
const B = createContext<{ value: Accessor<number> }>({ value: () => 2 });
function Child() { const s = useContext(B); return <p>{s.value()}</p>; }
function App() { const value = createMemo(async () => 1); return <A value={{ value }}><Child /></A>; }
render(() => <App />, document.body);
