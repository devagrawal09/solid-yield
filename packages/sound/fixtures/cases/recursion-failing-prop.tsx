import { createSignal, createMemo, Errored } from "solid-js";
import { render } from "@solidjs/web";
type TreeProps = { depth: number; children: number };
const Tree = (props: TreeProps) => {
  let { depth } = props;
  if (depth <= 0) return <i>{props.children}</i>;
  depth = depth - 1;
  return <b><Tree depth={depth}>{props.children}</Tree></b>;
};
export function App() {
  const [n] = createSignal(1);
  const checked = createMemo(() => { if (n() < 0) throw new RangeError("negative"); return n(); });
  return <Errored fallback={() => <p>failed</p>}><Tree depth={3}>{checked()}</Tree></Errored>;
}
render(App, document.body);