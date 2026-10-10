# listener-routine

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/listener-routine`

Input: Component-level handlers `const onEnter = () => setHover(true)` attached with `addEventListener` inside `onSettled` (Tooltip).

Expected: Accepted (listener callbacks from setup are events per the native core surface).

Actual: `Hover.tsx:8:40 [SUGAR_ESCAPE] Routine onEnter is handed to an unknown consumer; a plain callback cannot drive it.` Declaring the arrows inside the onSettled callback is accepted.
