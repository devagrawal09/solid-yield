---
"@solidjs/blocks": minor
"@solidjs/eslint-plugin-blocks": minor
---

`view(fn)`, a zero-runtime typing wrapper for a view (D-054). `return view(function* () { return <…/>; })` type-checks the view where it is written. A creation or a write in a view, or a read in an `h` view (`[HVIEW_READ]`), is reported at the `view(` call and names the op. Without the wrapper it is reported at the `$component(` call, possibly dozens of lines up, with the whole setup's yield union. TypeScript cannot report it on the offending `yield*` itself, because it does not check a `yield*` against a contextual yield type. At run time `view` is the identity, and the view's colors are kept: a wrapped pending view still makes its component pending. There is no `setup()` wrapper, since a setup's errors already land locally. `@solidjs/eslint-plugin-blocks`: new `prefer-view-wrapper`, a warning in `recommended` (the first rule there that is not an error), with an autofix that wraps the view and imports `view`. View recognition now sees through `return view(…)`, so the other rules still apply to a wrapped view. Every twin view was wrapped with the autofix: 98 views in 9 twins.
