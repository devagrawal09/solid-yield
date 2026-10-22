import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
function makeService() { const [count] = createSignal(1); const double = createMemo(() => count() * 2); return { double }; }
const C = createContext<ReturnType<typeof makeService>>();
function Child() { const s = useContext(C); return <p>{s.double()}</p>; }
function App() { const s = makeService(); return <C value={s}><Child /></C>; }
render(() => <App />, document.body);
