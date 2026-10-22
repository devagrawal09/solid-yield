import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
function makeService() { return { save: async () => { throw new Error("bad"); } }; }
const C = createContext<ReturnType<typeof makeService>>();
function Child() { const { save: run } = useContext(C); return <button onClick={async () => { await run(); }}>save</button>; }
function App() { const s = makeService(); return <C value={s}><Child /></C>; }
render(() => <App />, document.body);
