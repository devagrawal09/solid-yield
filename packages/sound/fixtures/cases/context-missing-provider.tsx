import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
const C = createContext<{ label: string }>();
function App() { const s = useContext(C); return <p>{s.label}</p>; }
render(() => <App />, document.body);
