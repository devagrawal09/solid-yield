import { createMemo } from "solid-js";
import { getProduct } from "./api";
import { money } from "./format";
export function Details(props: { id: string }) {
  const prod = createMemo(() => getProduct(props.id));
  return <div><h2>{prod().name}</h2><p>{prod().price}</p></div>;
}
