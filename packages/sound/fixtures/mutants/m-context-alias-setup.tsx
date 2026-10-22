import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
const C = createContext<{ count: Accessor<number> }>();
function service() { return useContext(C); }
function Child() { const { count: read } = service(); const again = read; const n = again(); return <p>{n}</p>; }
function App() { const [count] = createSignal(1); return <C value={{ count }}><Child /></C>; }
render(() => <App />, document.body);
