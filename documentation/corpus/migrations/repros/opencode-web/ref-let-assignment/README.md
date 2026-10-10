# `let el; <div ref={el}>` (ref assignment) is lowered as a ref *callback*

Commands: `./node_modules/.bin/solid-yield check .`, `node ../runtime-harness.mjs`

Expected: 0 errors (Solid's compiler turns `ref={scrollRef}` on a `let` into an assignment; plain Solid 2 runs it).

Actual: generated `ref={__nativeCallback($event(function* (...args) { return scrollRef(...args); }))}` and errors such as
`TS2349 This expression is not callable. Type 'HTMLDivElement' has no call signatures`,
`TS2722 Cannot invoke an object which is possibly 'undefined'`, `TS2322 … not assignable to type 'Ref<HTMLDivElement>'`
(reported at the component name as `[generated]`). opencode-web: ChatView.tsx `ref={scrollRef}`, MessageInput.tsx `ref={textareaRef}`.

Runtime (`node ../runtime-harness.mjs`): plain and plain-dev render without errors; yield throws
`TypeError: scrollRef is not a function` and yield-dev `[UNTYPED_THROW] an event in <Box>: scrollRef is not a function`.
In opencode-web the same form on MessageInput's (unused) `textareaRef` broke the composer under the yield build
("f is not a function" on every page load); the checker had reported it, so this is a refusal-quality issue, not a
strict-subset violation.
