# event-read-in-prop-call

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/event-read-in-prop-call`

Input: `onChange={(e) => props.onChange(e.currentTarget.checked)}`; `LocalControl.tsx` reads `e.currentTarget.checked` into a local first and passes.

Expected: Lowers (an event reading its own event object).

Actual: `Inline.tsx:1:17 [generated] [SUGAR_CALLBACK] Move this reactive read into JSX, a memo, an effect, or an event.` - the read is already in an event; location is the component name. Related to F-S19 (call arguments). App: ToggleSwitch, UnitSelector.
