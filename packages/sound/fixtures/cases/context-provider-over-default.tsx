import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
const C = createContext({ read: () => 0 });
function Child() { const s = useContext(C); return <p>{s.read()}</p>; }
function App() { const read = createMemo(() => { throw new Error("bad"); }); return <C value={{ read }}><Child /></C>; }
render(() => <App />, document.body);
