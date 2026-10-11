import { createMemo, createSignal, createStore, For, isPending, latest } from "solid-js";
import { drive } from "./bridge";
import { ticks } from "./runtime";

function Totals(props: { totals: () => number }) {
  const shown = () => latest(props.totals);
  return <p class={isPending(props.totals) ? "stale" : ""}>{shown().toFixed(1)}</p>;
}

export function Checkout() {
  const [cart, setCart] = createStore([{ name: "a", price: 2, quantity: 1 }]);
  const [phase, setPhase] = createSignal("idle");
  const total = () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tick = createMemo<number>(() => ticks(total()));
  const place = drive(function* (count: number) {
    setPhase("reserving");
    const reserved = yield Promise.resolve(count);
    setPhase(`placed ${reserved}`);
    return reserved;
  });
  return (
    <section>
      <For each={cart}>
        {item => (
          <p>
            {item.name}: {item.quantity}
          </p>
        )}
      </For>
      <button onClick={() => setCart(c => void c[0].quantity++)}>more</button>
      <button onClick={() => place(cart.length).catch(() => {})}>place</button>
      <p>{phase()}</p>
      <Totals totals={tick} />
    </section>
  );
}
