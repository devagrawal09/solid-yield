// The proposal's `prune`, as a convention: an effect in the page that owns the record.
import { $effect, type Source } from "solid-yield";
import type { Slice } from "./lens";

/**
 * `yield* prune(drafts, ids)` in a setup: the compute reads the live keys, the
 * effect phase deletes the entries whose key is gone. Leave it out to keep them.
 */
export function prune<S>(slice: Slice<Record<string, S>>, live: Source<readonly string[]>) {
  return $effect(
    function* () {
      return yield* live;
    },
    function* (keys) {
      const kept = new Set(keys);
      yield* slice.set(d => {
        for (const key of Object.keys(d)) if (!kept.has(key)) delete d[key];
      });
    }
  );
}
