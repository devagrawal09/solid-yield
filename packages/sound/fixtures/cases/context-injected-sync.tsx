import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
interface Api { run(): void }
declare const api: Api;
const C = createContext<Api>();
function Child() { const { run: act } = useContext(C); return <button onClick={act}>run</button>; }
function App() { return <C value={api}><Child /></C>; }
render(() => <App />, document.body);
