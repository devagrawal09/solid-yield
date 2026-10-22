import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
function makeService() { const [count, setCount] = createSignal(0); return { count, set: () => setCount(1) }; }
const C = createContext<ReturnType<typeof makeService>>();
function Child() { const s = useContext(C); const result = createMemo(() => s.set()); return <p>{result()}</p>; }
function App() { const s = makeService(); return <C value={s}><Child /></C>; }
render(() => <App />, document.body);
