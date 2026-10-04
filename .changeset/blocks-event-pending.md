---
"solid-blocks": minor
---

An event exposes its in-flight state as a source (D-075): `save.pending: Source<boolean, never, false>` is `true` while any call of `save` is paused on a pending read or awaiting an async attempt, and `false` otherwise. Read it in a hole like any source: `<button disabled={yield* save.pending}>`. A call never shows a `Loading`.
