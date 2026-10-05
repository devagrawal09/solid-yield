---
"solid-blocks": minor
"eslint-plugin-solid-blocks": minor
---

`view(function* () { … })` is the one spelling of a view (D-089). A setup that returns a bare `function*` is now a type error at the `$component(` call: `[VIEW_WRAPPER] wrap the view: return view(function* () { ... })`; a row's bare view matches no overload of its flow control. `view` brands what it returns (`ViewFn<Y, R>`; `ViewWrapped` and `ViewWrapperCheck` are exported); it is still the identity at run time. The lint rule `prefer-view-wrapper` (a warning) is renamed `require-view-wrapper` and is an error in `recommended`; its autofix wraps the view in `view(…)` and imports it.
