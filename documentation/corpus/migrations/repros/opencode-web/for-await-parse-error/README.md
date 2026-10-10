# `for await` in an async function that writes state: internal BABEL_PARSE_ERROR

Command: `./node_modules/.bin/solid-yield check .`

Expected: accepted (or a mapped refusal naming the construct). Plain Solid 2 runs it.

Actual: `Feed.tsx:14:9 [BABEL_PARSE_ERROR] …/Feed.tsx: Unexpected token, expected "(" (16:12)` — the async function is
rewritten to a generator but `for await` is kept, so the *intermediate* program does not parse; the reported
(L:C) inside the message is an intermediate position, not the source's. Replacing `for await` with a manual
`it.next()` loop is accepted.
