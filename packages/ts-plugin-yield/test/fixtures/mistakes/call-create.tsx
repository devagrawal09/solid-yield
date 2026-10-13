import { createMemo, createSignal, Errored } from "solid-js";
const money = (n: number) => "$" + n;
export function Price() {
  const [cents] = createSignal(100);
  return (
    <Errored fallback={<p>error</p>}>
      <p>{money(createMemo(() => cents() / 100)())}</p>
    </Errored>
  );
}
