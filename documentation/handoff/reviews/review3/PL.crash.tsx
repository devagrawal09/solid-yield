import { createMemo, For } from "solid-js";
import { listProducts } from "./api";
import { money } from "./format";
import { useCart } from "./cart";
export function ProductList() {
  const cart = useCart();
  const products = createMemo(() => listProducts());
  const add = (e: Event) =>
    cart.setItems([{ id: "x", name: "n", price: 1 }]);
  return (
    <ul>
      <For each={products()}>{p => <li>{p().name} {money(p().price)} <button data-id={p().id} data-name={p().name} data-price={p().price} onClick={add}>add</button></li>}</For>
    </ul>
  );
}
