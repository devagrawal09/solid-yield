---
"@solidjs/blocks": minor
"@solidjs/eslint-plugin-blocks": minor
---

JSX belongs only to a view, a hole or a row's view (D-041): a setup never creates elements. New lint rule `jsx-only-in-view`, an error in `recommended`. It reports JSX in a setup, a row's setup, a `$memo`, an `$effect` or an `$event`, and also in a plain function declared in one of them. A render callback inside a view's JSX (`{props => <Loading>…</Loading>}`) is not reported. In development a hole performed while a setup is the host is `[JSX_IN_SETUP] <Component>: JSX in a setup`. Twins: hackernews-spa's and room's App now build the router tree in their view, which runs once (D-032). Before, they built it in the setup so a re-rendering view would not re-create the router. migrating-element keeps its hoisted `<Canvas />`, the point of the example, behind a commented `eslint-disable`; this is a recorded finding.
