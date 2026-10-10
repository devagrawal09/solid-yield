import { For } from "solid-js";
export function P13b(props: { items: string[] }) {
  return <For each={props.items}>{(x) => (x.length ? <b>{x}</b> : <i>{x}</i>)}</For>;
}
