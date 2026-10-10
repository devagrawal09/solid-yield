import { createSignal } from "solid-js";

// A pure helper: no reactive reads/writes, only a try/catch.
function parseStored(raw: string | null): { theme: string } {
  try {
    return raw ? JSON.parse(raw) : { theme: "dark" };
  } catch {
    return { theme: "dark" };
  }
}

export function A() {
  const [cfg] = createSignal(parseStored(localStorage.getItem("cfg")));
  return <p>{cfg().theme}</p>;
}
