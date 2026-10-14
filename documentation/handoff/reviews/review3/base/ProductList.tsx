import { createMemo, For, useContext } from "solid-js";
import { listProducts } from "./api";
import { money } from "./format";
import { CartCtx } from "./cart";
export function ProductList() {
  const [items, setItems] = useContext(CartCtx);
  const products = createMemo(() => listProducts());
  return (
    <ul>
      <For each={products()}>{p => <li>{p.name} {money(p.price)} <button onClick={() => setItems([...items(), p])}>add</button></li>}</For>
    </ul>
  );
}
