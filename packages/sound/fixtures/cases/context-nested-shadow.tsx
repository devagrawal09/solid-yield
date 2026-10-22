import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
const C = createContext<{ value: Accessor<number> }>();
function Child() { const s = useContext(C); return <p>{s.value()}</p>; }
function App() { const outer = createMemo(async () => 1); const [inner] = createSignal(2); return <C value={{ value: outer }}><C value={{ value: inner }}><Child /></C></C>; }
render(() => <App />, document.body);
