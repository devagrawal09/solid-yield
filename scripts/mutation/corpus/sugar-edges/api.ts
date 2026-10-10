export class Missing extends Error {}
export async function loadRows(
  range: string
): Promise<{ id: string; title: string; score: number }[]> {
  await Promise.resolve();
  if (range === "none") throw new Missing("no rows");
  return [{ id: "a", title: "Alpha", score: 1.5 }];
}
