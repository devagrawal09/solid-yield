# A function prop called inside a frame/observer callback in onSettled: internal BABEL_PARSE_ERROR

Command: `./node_modules/.bin/solid-yield check .`

Expected: accepted (the callbacks run outside any reactive scope; plain Solid 2 runs it).

Actual: `Row.tsx:12:15 [BABEL_PARSE_ERROR] …/Row.tsx: Unexpected reserved word 'yield'. (18:15)` — the prop read is lowered to
`yield* props.measure` inside a non-generator arrow. Refusal; blocks the Vite build.
