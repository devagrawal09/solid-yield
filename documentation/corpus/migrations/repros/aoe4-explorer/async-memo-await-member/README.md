# async-memo-await-member

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/async-memo-await-member`
(this tsconfig has `strictNullChecks: true`, like the app; see ../async-memo-no-failure for what `strict: false` adds)

Input: four async memos. `AwaitMember.tsx`: `createMemo(async () => (await fetch(url)).text())`.
Controls: `LocalThenCall.tsx` (`const r = await fetch(url); return r.text()`), `MemberOnly.tsx` (`(await SDK).units`,
property read only), `ReadBeforeAwait.tsx` (signal read, `const sdk = await SDK`, `sdk.units.slice(...)`), and
`HelperControl.tsx` (the fetch moved into an async helper).

Expected: all lower (none reads a reactive source after the await; AwaitMember reads nothing reactive at all).

Actual: only `AwaitMember.tsx:2:17 error TS95000: [generated] [SUGAR_CALLBACK] Move this reactive read into JSX, a memo,
an effect, or an event.` (reported at the component name). A method call whose receiver is `(await x).y` inside an
async memo is refused. In the app this hit 6 of the 11 direct async-memo resource replacements
(`(await SDK).units.where(...)`, `(await import(...)).patches.find(...)`); binding `const sdk = await SDK` first fixes it.
