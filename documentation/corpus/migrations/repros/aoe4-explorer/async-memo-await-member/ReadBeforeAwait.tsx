import { createMemo, createSignal } from "solid-js";
const SDK = import("./data");
export function ReadBeforeAwait() {
  const [n, setN] = createSignal(1);
  const units = createMemo(async () => {
    const count = n();
    const sdk = await SDK;
    return sdk.units.slice(0, count);
  });
  return <button onClick={() => setN(n() + 1)}>{units().join(",")}</button>;
}
