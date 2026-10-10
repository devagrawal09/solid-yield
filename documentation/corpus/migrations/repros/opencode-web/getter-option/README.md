# A reactive getter in an options object is refused with a message about async functions

Command: `./node_modules/.bin/solid-yield check .`

Expected: either accepted (plain Solid 2 runs it; it is @tanstack/solid-virtual's documented pattern) or a refusal that
names getters. Actual: `List.tsx:10:14 [SUGAR_HOST] Reactive operations in async functions or methods are unsupported.`
(nothing here is async). With the getter replaced by `count: 3`, the next error is
`[NATIVE_SETUP_FAILURE] Move this throw into a memo or rendered work, or handle it with attempt; the component body only
creates state` at the package call: every third-party factory called in a component body is `unknown` and therefore
an error; the message talks about a throw that does not exist and suggests `attempt`, which native code cannot import.
