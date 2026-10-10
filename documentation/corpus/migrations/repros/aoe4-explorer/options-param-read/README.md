# options-param-read

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/options-param-read`

Input: A non-component exported function that reads a property of its plain options parameter (or destructures it) and then calls `render`. `NoOptionsControl.tsx` without the options read passes.

Expected: Lowers: `options.title` is a plain object property, not a reactive source.

Actual: `MemberRead.tsx:5:17` and `Destructured.tsx:5:17 [generated] [SUGAR_CALLBACK] ...` at the function name. App: `src/index.tsx` `initializeExplorer(el, options)` (library entry) - still refused; no rewrite keeps the public API.
