# indexed-by-signal

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/indexed-by-signal`

Input: `<For each={data()?.[view()] ?? []}>` - a memo's value indexed by another signal (QuickNav: `data()?.[view()]`).
`LocalKeyControl.tsx` reads `view()` into a local first.

Expected: accepted (a computed member access, not a call).

Actual: `Tabs.tsx:3:17 error TS95000: [generated] [SUGAR_READ_ARGS] A source read takes no arguments.` at the component
name - the element access with a reactive key is lowered as a source read with an argument.

`LocalKeyControl.tsx` (key read into a local, then `data()?.[key]`) fails the same way, so a dynamic index into a
memo's value cannot be written at all; the app rewrote QuickNav to iterate all groups and `<Show>` the selected one.
