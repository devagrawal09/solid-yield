---
"@solidjs/blocks": patch
---

The server-component example twins are removed (D-058): the blocks model has no server components, since the plan is for a future compiler to find inert regions and turn them into server components itself. `examples/notes-blocks`, `examples/hackernews-blocks` and `examples/chat-blocks` are deleted. Their originals are server-component demos, so a client-only conversion would have had no parity oracle, and `hackernews-spa-blocks` already covers Hacker News over server functions. `examples/room-blocks` becomes the original's `/live` page, live server functions with SSR, served at `/` and `/live`. The original's `/` page, one live server component and about 300 of the twin's 2,500 lines, is dropped along with its parity steps (23 → 13), behavior tests (7 → 4) and browser steps. The blocks gate now expects 9 twins, and its baseline is regenerated (41 pass / 2 fail over 43 steps, with the same two pre-existing reds).
