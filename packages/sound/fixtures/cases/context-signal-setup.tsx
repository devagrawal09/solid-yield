import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
const C = createContext<{ count: Accessor<number> }>();
function Child() { const s = useContext(C); const n = s.count(); return <p>{n}</p>; }
function App() { const [count] = createSignal(1); return <C value={{ count }}><Child /></C>; }
render(() => <App />, document.body);
