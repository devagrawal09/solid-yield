import { createMemo } from "solid-js";
export function LocalThenCall() {
  const a = createMemo(async () => {
    const r = await fetch("/x");
    return r.text();
  });
  return <main>{a()}</main>;
}
