// A lens, as a convention: a path to read and the handler that writes it.
import { $event, type EventHandler, type Path, type Read, type Source } from "solid-yield";

/** `set` is a synchronous event (no wait, no async work): an effect's phase may call it. */
export type Slice<S> = {
  readonly at: Path<S>;
  readonly set: EventHandler<[write: (draft: S) => void], never, unknown, false, false>;
};

/** Narrow a slice to one key: the path at the key, a setter event over the parent's. */
export function focus<S, K extends keyof S & string>(part: Slice<S>, key: K): Slice<S[K]> {
  return {
    at: (part.at as unknown as Record<K, Path<S[K]>>)[key],
    set: $event(function* (write: (draft: S[K]) => void) {
      yield* part.set(draft => {
        write(draft[key]);
      });
    })
  };
}

/**
 * The proposal's `at(lens, key, init)`: one entry of a record slice, for a row
 * whose key is a source. Nothing here reads the key: `read` reads it where it is
 * used (a hole), `set` in its event; the entry is created on its first write.
 */
export function rowSlice<S>(slice: Slice<Record<string, S>>, key: Source<string>, init: () => S) {
  return {
    *read(): Generator<Read<false, never>, S, unknown> {
      const at = slice.at as unknown as Record<string, Path<S | undefined>>;
      return (yield* at[yield* key]) ?? init();
    },
    set: $event(function* (next: (prev: S) => S) {
      const id = yield* key;
      yield* slice.set(d => {
        d[id] ??= init();
        d[id] = next(d[id]);
      });
    })
  };
}
