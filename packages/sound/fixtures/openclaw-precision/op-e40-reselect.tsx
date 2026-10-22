import { merge } from "solid-js";
function Control(initial: { onReselect?: () => void }) {
  const props = merge({ onReselect: () => {} }, initial);
  return <input type="radio" checked onClick={() => { props.onReselect?.(); }} />;
}
const callback = () => {};
export function App() { return <Control onReselect={callback} />; }
