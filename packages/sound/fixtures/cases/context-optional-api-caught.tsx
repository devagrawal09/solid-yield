import { createContext, useContext, createSignal, createMemo, Loading, Errored } from "solid-js";
import type { Accessor } from "solid-js";
import { render } from "@solidjs/web";
interface Api { save(): Promise<void> }
function makeService(api?: Api) { const actual = api ?? { save: async () => {} }; return { save: () => actual.save() }; }
const C = createContext<ReturnType<typeof makeService>>();
function Child() { const s = useContext(C); return <button onClick={async () => { try { await s.save(); } catch { console.log("handled"); } }}>save</button>; }
function App(props: { api?: Api }) { const s = makeService(props.api); return <C value={s}><Child /></C>; }
declare const injectedApi: Api | undefined;
render(() => <App api={injectedApi} />, document.body);
