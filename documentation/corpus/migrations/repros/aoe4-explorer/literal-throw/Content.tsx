import { createMemo } from "solid-js";
async function fetchContent(): Promise<string[]> {
  try {
    const res = await fetch("/content.json");
    const items = await res.json();
    if (!items[0]) throw "Response not in expected format";
    return items;
  } catch (e) {
    console.error(e);
    return [];
  }
}
export function Content() {
  const items = createMemo(() => fetchContent());
  return <ul>{items().join(",")}</ul>;
}
