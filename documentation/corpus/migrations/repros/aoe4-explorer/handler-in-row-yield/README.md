# handler-in-row-yield

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/handler-in-row-yield`

Input: named local event handlers (the "Local synchronous `onClick={fn}`" row of the native mapping table).
`Selector.tsx`: a handler that writes a signal and calls a prop, invoked from `onClick={() => toggle(id)}` in a `<For>` row.
`ContextToggle.tsx`: `const onKeyDown = (e) => { if (...) toggle(); }` bound as `onKeyDown={onKeyDown}` at a component's top
level, where `toggle` comes from a context value.

Expected: both lower.

Actual: the lowering emits `yield` outside a generator and its own re-parse fails:
`Selector.tsx:5:9 error TS95000: [generated] [BABEL_PARSE_ERROR] ... Unexpected reserved word 'yield'. (14:5)` and
`ContextToggle.tsx:13:33 error TS95000: [BABEL_PARSE_ERROR] ... Unexpected reserved word 'yield'. (40:33)` (the `(line:col)` in
the message is in the intermediate program). App sites (all worked around by inlining the handler body into an arrow):
UnitSelector `handleSelectUnit`, TechnologySelector `toggleTechnology` and `toggleAllTechnologies` (inside `<Loading>`),
SidebarNav `TreeGroupToggle` `onKeyDown`/`onClick={toggle}`.
