import { createMemo, createSignal, For, Errored } from "solid-js";
import { render } from "@solidjs/web";
type Equipment = { id: string; name: string };
declare function fetchList(): Promise<readonly Equipment[]>;
function Row(props: { item: Equipment }) {
  return <p>{props.item.name}</p>;
}
function Inventory(props: { list: () => readonly Equipment[] }) {
  return <For each={props.list()}>{item => <Row item={item} />}</For>;
}
function App() {
  const [revision, setRevision] = createSignal(0);
  const list = createMemo(() => { revision(); return fetchList(); });
  return <Errored fallback={<p>failed</p>}><button onClick={() => setRevision(r => r + 1)}>reload</button><Inventory list={list} /></Errored>;
}
render(() => <App />, document.body);
