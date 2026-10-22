import { createSignal } from "solid-js";
import { render } from "@solidjs/web";
interface Api { get(id: string): Promise<string>; set(id: string, v: string): void; map(v: string): string }
declare function createApi(): Api;
function Panel(props: { api: Api }) {
  const [n, setN] = createSignal("");
  return <div>
    <button onClick={async () => setN(await props.api.get("a"))}>get</button>
    <button onClick={() => props.api.set("a", n())}>set</button>
    <button onClick={() => setN(props.api.map(n()))}>map</button>
    <p>{n()}</p>
  </div>;
}
function App() {
  return <Panel api={createApi()} />;
}
render(() => <App />, document.body);
