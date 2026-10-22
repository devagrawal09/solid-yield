import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
const C = createContext<{ value: Accessor<number> }>();
function Child() { const s = useContext(C); return <button onClick={() => { s.value(); }}>read</button>; }
function App() { const value = createMemo(() => { throw new Error("bad"); }); return <C value={{ value }}><Errored fallback={() => "failed"}><Child /></Errored></C>; }
render(() => <App />, document.body);
