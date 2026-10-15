import { createContext, createSignal } from "solid-js";
import type { Product } from "./api";
export const makeCart = () => createSignal<Product[]>([]);
export const CartCtx = createContext<ReturnType<typeof makeCart>>();
