import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
type Service = { read: () => number };
declare function store(s: Service): void;
const C = createContext<Service>();
function Child() { const s = useContext(C); try { store(s); } catch { console.log("handled"); } return <p>{s.read()}</p>; }
function App() { return <C value={{ read: () => 1 }}><Child /></C>; }
render(() => <App />, document.body);
