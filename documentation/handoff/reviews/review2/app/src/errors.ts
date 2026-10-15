export class FetchError extends Error { constructor(m: string) { super(m); this.name = "FetchError"; } }
export async function fetchTodos(id: string): Promise<{ id: number; title: string }[]> {
  await new Promise(r => setTimeout(r, 10));
  if (id === "bad") throw new FetchError("bad list");
  return [{ id: 1, title: "a" }, { id: 2, title: "b" }];
}
