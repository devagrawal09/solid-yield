import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
type Service = { read: () => number };
let escaped: Service | undefined;
const C = createContext<Service>();
function Child() { const s = useContext(C); escaped = s; return <p>{escaped.read()}</p>; }
function App() { return <C value={{ read: () => 1 }}><Child /></C>; }
render(() => <App />, document.body);
