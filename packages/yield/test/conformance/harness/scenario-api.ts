/**
 * The `conformance` module as a library scenario sees it (tsconfig `paths`
 * maps the specifier here, so `scenarios/sources/*.library.tsx` type-check
 * against the library's own types). At run time the runner injects
 * `probe()`'s object (trace.ts); this file only types it.
 */
import type { Setter, Create, Source, Yieldable } from "solid-yield";

export { NotFound, Forbidden } from "./trace.js";

export interface ScenarioProbe {
  /** `yield* $signal(initial)` with traced reads and writes (a creation: setup only). */
  $signal<T>(label: string, initial: T): Yieldable<Create<"signal">, [Source<T>, Setter<T>]>;
  /** A source's value, read by the harness for a trace label (never routine semantics). */
  peek<T>(source: Source<T, any, boolean>): T;
  run(label: string): void;
  cleanup(label: string): void;
  owner(label: string): void;
  where(label: string): void;
  task<T = unknown>(label: string, ...input: unknown[]): Promise<T>;
  value(label: string, value: unknown): void;
  caught(label: string, error: unknown): void;
  log(kind: string, label: string, ...value: [] | [unknown]): void;
}

export declare const h: ScenarioProbe;
