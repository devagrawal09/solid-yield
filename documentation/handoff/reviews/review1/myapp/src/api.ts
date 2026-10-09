export type Item = { id: number; name: string };
export async function fetchItems(): Promise<Item[]> {
  await new Promise(r => setTimeout(r, 50));
  if (Math.random() < 0.0) throw new Error("boom");
  return [{ id: 1, name: "a" }, { id: 2, name: "b" }];
}
