import { merge } from "solid-js";
function Control(initial: { onChange?: (values: string[]) => void }) {
  const props = merge({ onChange: (_values: string[]) => {} }, initial);
  const commit = (value: string) => props.onChange?.([value]);
  const select = (value: string) => commit(value);
  return <button onClick={() => select("row")}>select</button>;
}
const callback = (_values: string[]) => {};
export function App() { return <Control onChange={callback} />; }
