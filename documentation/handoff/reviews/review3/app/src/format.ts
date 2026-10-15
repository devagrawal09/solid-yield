// third-party-ish helper, no directive
export function money(n: number) { return "$" + Math.round(n * 100) / 100; }
export function sum(xs: number[]) { let t = 0; for (const x of xs) t += x; return t; }
export function parseId(s: string) { if (!s) throw new Error("empty id"); return s; }
