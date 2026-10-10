# undeclared-prop

Command: `cd /home/user/migrations/aoe4-explorer && pnpm exec solid-yield check /home/user/migrations/feedback/aoe4-explorer-repros/undeclared-prop/<subdir>`
(the top directory itself is the cross-module case)

Input: a component `Icon(props: { icon: string; class?: string })` (arrow `Component<P>` in `Icon.tsx`, function
declaration in `fn-control/`, same file in `same-file*/`). One caller passes a pending value (`icon={name()}` from an
async memo, inside `<Loading>`); another passes literals (`<Icon icon="bug" class="mr-1" />`).

Expected: no errors (D-119: the pending prop widens the declaration; literal callers are unaffected).

Actual, tsconfig `strict: false` + `strictNullChecks: true` (the app's config): every call site reports its props as
undeclared - `Page.tsx:5:13 error TS2322: [UNDECLARED_PROP] \`icon\` is not a declared prop`, `... \`class\` ...`, and the
colored caller too. Same for the function declaration and in a single file.
`same-file-strict/` (`strict: true`): 0 errors. `flag-strictFunctionTypes/` (only `strictFunctionTypes` added): 0 errors.
`flag-noImplicitAny/`, `flag-strictBindCallApply/`: still 3 errors. So the D-119 widening needs `strictFunctionTypes`; without
it the checker produced 384 of the app's 760 errors (Icon, StatBar/StatNumber/StatDps/StatCosts/StatLos, Tooltip,
FloatingTip, ProjectileDamageHint, patch Section...). Nothing in the install docs says strict is required.
