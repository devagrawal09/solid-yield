import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
function Child(p: { value: number }) { return <p>{p.value}</p>; }
const C = createContext<{ value: Accessor<number> }>();
function Parent() { const s = useContext(C); return <Errored fallback={() => "failed"}><Loading fallback="wait"><Child value={s.value()} /></Loading></Errored>; }
function App() { const value = createMemo(async () => { throw new Error("bad"); }); return <C value={{ value }}><Parent /></C>; }
render(() => <App />, document.body);
