import { createMemo } from "solid-js";
async function compute(n: number) {
  return n * 2;
}
export function NoFailure() {
  const c = createMemo(() => compute(2));
  return <main>{c()}</main>;
}
