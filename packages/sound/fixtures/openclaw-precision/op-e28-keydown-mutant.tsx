import { merge } from "solid-js";
function Control(initial: { onChange?: (values: string[]) => void }) {
  const props = merge({ onChange: (_values: string[]) => {} }, initial);
  const removeAt = (index: number) => props.onChange?.([String(index)]);
  const handleKeydown = (event: KeyboardEvent) => { if (event.key === "Backspace") removeAt(0); };
  return <input onKeyDown={handleKeydown} />;
}
declare const callback: (values: string[]) => void;
export function App() { return <Control onChange={callback} />; }
