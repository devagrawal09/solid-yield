import { render } from "@solidjs/web";
import { createSignal } from "solid-js";
import { Preview } from "./Preview";

function App() {
  const [n, setN] = createSignal(0);
  return <Preview title={`t${n()}`} onFav={(t: string, e: MouseEvent) => setN(n() + 1)} />;
}
render(() => <App />, document.body);
