import { createMemo } from "solid-js";
export function Catch() {
  const value = createMemo(() => {
    try {
      throw new Error("handled");
    } catch {
      return 7;
    } finally {
      void 0;
    }
  });
  return <p>{value()}</p>;
}
