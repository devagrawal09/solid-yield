/** Compiler-only spellings of Solid's value type contracts. */
import type { Source, Setter, Component } from "./types.js";
import type { Element } from "./element.js";
export type NativeSignal<T> = [Source<T>, Setter<T>];
export type NativeParentProps<P = {}> = P & { children?: Element };
export type NativeParentComponent<P = {}> = Component<NativeParentProps<P>>;
export type NativeVoidComponent<P = {}> = Component<P & { children?: never }>;
