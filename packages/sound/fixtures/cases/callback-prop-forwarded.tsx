import { createSignal } from "solid-js";
function Leaf(props: { onPick: (v: number) => void }) {
  return <button onClick={() => props.onPick(2)}>leaf</button>;
}
function Middle(props: { onPick: (v: number) => void }) {
  const { onPick } = props;
  return <><Leaf onPick={props.onPick} /><button onClick={() => onPick(1)}>mid</button></>;
}
function Direct(props: { onClick: () => void }) {
  return <button onClick={props.onClick}>direct</button>;
}
export function App() {
  const [n, setN] = createSignal(0);
  return <><Middle onPick={v => setN(n() + v)} /><Direct onClick={() => setN(0)} /></>;
}