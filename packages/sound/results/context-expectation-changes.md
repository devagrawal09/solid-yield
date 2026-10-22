# Expectation changes (D-129, amended by D-130)

25 expectation entries in 25 fixtures move from warning to error: 15 from the old slice and 10 from the context/services slice. Codes, counts, primary anchors and related anchors are unchanged. Static severity is error; runtime.severity remains warn. Partial-check boundary findings and pending-handler findings remain warnings.

| fixture | code | anchors |
|---|---|---|
| context-signal-setup | STRICT_READ_UNTRACKED | s.count() |
| context-method-setup | STRICT_READ_UNTRACKED | count() |
| context-async-uncovered | ASYNC_OUTSIDE_LOADING_BOUNDARY | s.value() |
| context-module-escape | ASYNC_OUTSIDE_LOADING_BOUNDARY | escaped.read() |
| context-unknown-escape | ASYNC_OUTSIDE_LOADING_BOUNDARY | s.read() |
| context-prop-uncovered | ASYNC_OUTSIDE_LOADING_BOUNDARY | p.value |
| setup-read | STRICT_READ_UNTRACKED | count() |
| return-ternary | STRICT_READ_UNTRACKED | n() |
| return-and | STRICT_READ_UNTRACKED | n() |
| named-callback-in-setup | STRICT_READ_UNTRACKED | n(); map(scale); [1, 2].map(scale) |
| array-callback-in-setup | STRICT_READ_UNTRACKED | items().filter; n()) |
| getter-read-in-setup | STRICT_READ_UNTRACKED | o.double; n() * 2 |
| pending-root | ASYNC_OUTSIDE_LOADING_BOUNDARY | {n()}; render(App |
| iife-pending-root | ASYNC_OUTSIDE_LOADING_BOUNDARY | p() * 2; (() => p() * 2)(); render(App |
| async-setup-reads | STRICT_READ_UNTRACKED | return n(); load() |
| m-context-loading-removed | ASYNC_OUTSIDE_LOADING_BOUNDARY | s.value() |
| m-context-shadow-removed | ASYNC_OUTSIDE_LOADING_BOUNDARY | s.value() |
| m-context-alias-setup | STRICT_READ_UNTRACKED | again() |
| m-context-prop-child-loading-removed | ASYNC_OUTSIDE_LOADING_BOUNDARY | p.value |
| m-loading-removed | ASYNC_OUTSIDE_LOADING_BOUNDARY | {m()}; render(App |
| m-read-moved-to-setup | STRICT_READ_UNTRACKED | count() |
| m-reactive-prop-read-in-setup | STRICT_READ_UNTRACKED | const title = props.title |
| m-pending-through-prop | ASYNC_OUTSIDE_LOADING_BOUNDARY | {p.n} |
| m-effect-phase-pending | PENDING_ASYNC_FORBIDDEN_SCOPE | m() + 1; () => console.log(m() + 1) |
| m-equipment-row-loading-removed | ASYNC_OUTSIDE_LOADING_BOUNDARY | props.list(); <Inventory list={list} />; render( |

m-pending-through-prop also tightens its primary location to Child’s {p.n}; n={n()} is required as related. Root/caller primary anchors no longer count (D-129d).

Equipment is intentionally promoted to the context subset. Its eight removed worst-case errors, seven removed partial warnings, retained ten real handler errors and two new pending-handler warnings are justified individually in fixtures/equipment/CONTEXT-EXPECTATION.md. Its old notice pending error remains absent under precise context analysis, not downgraded by D-130. No other expectations change.
