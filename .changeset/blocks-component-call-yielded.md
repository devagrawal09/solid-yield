---
"solid-blocks": minor
"eslint-plugin-solid-blocks": minor
---

An unyielded block call is refused (D-086). A component call that is not delegated to — `<>{Card({ todo })}</>`, `{[MainSection(…), Footer(…)]}` — still renders, but its pending and failures reached no type. `Fragment`'s children are now typed `Element`, as an element's are, so a pending or failing call in a fragment is a type error; TypeScript checks a fragment only when the tsconfig sets `"jsxFactory": "jsx"` and `"jsxFragmentFactory": "Fragment"` next to `jsxImportSource`, so add both. New lint rule `component-call-yielded` (an error in `recommended`): a block component call in JSX (directly, in an array, a conditional or a logical operand) or as a discarded statement, not delegated to with `yield*`; its autofix adds the `yield*`.
