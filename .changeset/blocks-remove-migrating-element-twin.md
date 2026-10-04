---
"@solidjs/blocks": patch
---

The migrating-element example twin is removed (D-061). Its point, an element held in a variable (`const hoistedCanvas = <Canvas />`) and shown from several `<Show>` slots so that one DOM node migrates between them, is exactly what D-041 forbids: an element is not a value in a block. Node migration remains a Solid feature, which the compiler route can show. The `eslint-disable` exception the twin carried is gone with it. The blocks gate now expects 8 twins, and its baseline is regenerated (37 pass / 2 fail over 39 steps, with the same two pre-existing reds).
