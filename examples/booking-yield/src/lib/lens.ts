// A lens, as a convention: a path to read and the handler that writes it.
import { $event, type Handler, type Path } from "solid-yield";

export type Slice<S> = { readonly at: Path<S>; readonly set: Handler<[write: (draft: S) => void]> };

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
