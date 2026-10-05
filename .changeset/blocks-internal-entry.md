---
"solid-blocks": minor
---

The root entry exports the user model only. The runtime's marks and helpers that the `h` entry shares (`READ`, `VIEW_MARK`, `COMPONENT_MARK`, `EVENT_MARK`, `bindEvent`, `blockName`, `holeOf`, `isGeneratorFunction`, `isRowBlock`, `renderView`, `rowArg`, `runRow`) are no longer exported from `solid-blocks`. They live in the runtime bundle, now its own subpath `solid-blocks/internal` (client / server × development / production, like the root), which the root and `solid-blocks/h` both import, so an app still holds one copy of the runtime. `solid-blocks/internal` is not documented and makes no compatibility promise.
