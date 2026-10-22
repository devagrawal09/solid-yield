import { createSignal } from "solid-js";
interface CardProps { title: string; count: number }
type RowProps = { label: string };
function Card(props: CardProps) {
  const title = props.title;
  return <p>{title} {props.count.toFixed(0)}</p>;
}
function Row(props: RowProps & { extra?: string }) {
  return <i>{props.label}{props.extra}</i>;
}
export function App() {
  const [t] = createSignal("a");
  return <><Card title={t()} count={1} /><Row label={t()} extra="x" /></>;
}
