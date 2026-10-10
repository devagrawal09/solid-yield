// A deterministic data source: each load waits 5 ms and numbers its fetch.
export class Missing extends Error {}
export interface RowData {
  id: string;
  title: string;
  score: number;
}
const DATA: Record<string, RowData[]> = {
  "24h": [
    { id: "a", title: "Alpha", score: 1.5 },
    { id: "b", title: "Beta", score: 0.5 }
  ],
  "7d": [
    { id: "c", title: "Gamma", score: 3 },
    { id: "d", title: "Delta", score: 2.25 }
  ]
};
let fetches = 0;
export async function loadRows(range: string): Promise<RowData[]> {
  await new Promise(resolve => setTimeout(resolve, 5));
  fetches++;
  const rows = DATA[range];
  if (!rows) throw new Missing(`no rows for ${range}`);
  return rows.map(row => ({ ...row, title: `${row.title} #${fetches}` }));
}
