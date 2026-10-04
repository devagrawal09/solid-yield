---
"@solidjs/blocks": patch
"@solidjs/eslint-plugin-blocks": patch
---

Flow controls take a hole as well as a source in JSX (D-038). `<Show when>`, `<Match when>`, `<For each>` and `<Repeat count>` accept a bare zero-arity `function*`, for example `<Show when={function* () { return (yield* todos).length > 0; }}>`. The runtime has run such a hole as the flow control's read since the bare-`function*` change, and the types now match. New JSX overloads take a settled hole, because a JSX element is settled. A hole over a pending source is a type error, as a pending source is; in `h` it is still allowed and colors the output. Before, the catch-all `when` overload inferred the condition's type as the function itself, so any function type-checked as an always-truthy value. A `function*` is now never a condition's value (`NotAHole<T>`).

`@solidjs/eslint-plugin-blocks`: `no-read-in-view-body` checks JSX views only (D-049). An `h` view, one with no JSX in its body, is held by its type (`[HVIEW_READ]`). The runtime's `READ_IN_VIEW` cannot tell the two flavors apart and still fires for an `h` view reached through a cast.
