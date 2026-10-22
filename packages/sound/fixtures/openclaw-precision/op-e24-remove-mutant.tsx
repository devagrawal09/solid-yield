import { merge } from "solid-js";
function Control(initial: { onChange?: (values: string[]) => void }) {
  const props = merge({ onChange: (_values: string[]) => {} }, initial);
  const removeAt = (index: number) => props.onChange?.([String(index)]);
  return <button onClick={() => removeAt(0)}>remove</button>;
}
declare const callback: (values: string[]) => void;
export function App() { return <Control onChange={callback} />; }
