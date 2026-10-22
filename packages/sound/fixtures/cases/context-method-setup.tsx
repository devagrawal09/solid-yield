import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
function makeService() { const [count] = createSignal(1); return { read: () => count() }; }
const C = createContext<ReturnType<typeof makeService>>();
function Child() { const s = useContext(C); const n = s.read(); return <p>{n}</p>; }
function App() { const s = makeService(); return <C value={s}><Child /></C>; }
render(() => <App />, document.body);
