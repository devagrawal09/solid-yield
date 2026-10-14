"use server";
import { NotFound, RateLimited } from "./errors";
export type Product = { id: string; name: string; price: number };
const DB: Product[] = [
  { id: "1", name: "Mug", price: 8 },
  { id: "2", name: "Shirt", price: 20 }
];
let calls = 0;
export async function listProducts(): Promise<Product[]> {
  if (++calls % 5 === 0) throw new RateLimited(30);
  return DB;
}
export async function getProduct(id: string): Promise<Product> {
  const p = DB.find(p => p.id === id);
  if (!p) throw new NotFound(id);
  return p;
}
export async function placeOrder(ids: string[], email: string): Promise<{ ok: true }> {
  if (!email.includes("@")) throw new RateLimited(1);
  return { ok: true };
}
