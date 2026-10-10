# writable-derived-signal

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/writable-derived-signal`

Input: `createSignal(() => props.isOpen)`: the Solid 2 writable derived signal from the cheatsheet.

Expected: Accepted (core createSignal).

Actual: `TreeGroup.tsx:4:50 [SUGAR_CALLBACK] Move this reactive read into JSX, ...` - the function form of createSignal is treated as an unknown callback.
