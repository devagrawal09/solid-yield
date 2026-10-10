# any-typed prop members become `unknown` / `Source<any>` in the generated program

Command: `./node_modules/.bin/solid-yield check .` (node_modules is a symlink to the opencode-web copy's).

Expected: 0 errors. `any` is valid TypeScript; plain Solid 2 and `tsc` accept both components.

Actual (3 errors, only in `Item`; the identical `TypedItem` is clean):
- `Item.tsx:10:24 TS2571 Object is of type 'unknown'` at `props.message.info.role`
- `Item.tsx:15:28 TS2339 Property 'type' does not exist on type 'Source<any, never, false>'` (For row value)
- `Item.tsx:16:25 TS2339 Property 'text' does not exist on type 'Source<any, never, false>'`

opencode-web's `src/api/client.ts` aliases every SDK type to `any`, so MessageItem.tsx got 10 such errors.
