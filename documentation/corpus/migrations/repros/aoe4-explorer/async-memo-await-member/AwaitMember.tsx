import { createMemo } from "solid-js";
export function R8() {
  const a = createMemo(async () => (await fetch("/x")).text());
  return <main>{a()}</main>;
}
