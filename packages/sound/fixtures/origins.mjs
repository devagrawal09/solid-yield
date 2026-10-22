// @ts-check
// Where each shared case comes from. Sources are copied byte-identically by
// extract.mjs; test/fixtures.test.mjs re-derives them and compares.
//
// kind "script": `fixtures` export of scripts/native/fixtures.mjs, by id.
// kind "table": a row [id, source, codes] of a `const programs = [...]` table in
// a legacy test file; template placeholders (${head}, ${signal}, …) are the
// test file's own top-level string constants, substituted as the test does.

/** @typedef {{ id: string, kind: "script", file: string }} ScriptOrigin */
/** @typedef {{ id: string, kind: "table", file: string, table: string, row: string }} TableOrigin */
/** @type {readonly (ScriptOrigin | TableOrigin)[]} */
export const ORIGINS = Object.freeze([
  // scripts/native/fixtures.mjs — review categories, one-liners
  ...[
    "counter", "props", "setup-read", "named-event", "inline-event", "pending-root", "colored-prop",
    "throw-error", "catch", "memo-write", "callback-read", "async-read", "handled-catch", "rethrow-catch",
    "promise-catch", "promise-event", "async-event-reads", "async-memo-reads", "async-setup-reads",
    "foreign-route-failure", "native-latest-pending", "timer-callback-failure", "native-for-indexed",
    "native-optimistic-store-basic", "ref-event-reads", "unknown-rethrow-catch", "event-updater"
  ].map(id => /** @type {ScriptOrigin} */ ({ id, kind: "script", file: "scripts/native/fixtures.mjs" })),
  // packages/vite-plugin-yield/test/native-paths.test.js — `programs`
  ...[
    "return-ternary", "return-and", "callback-prop-throws", "callback-prop-unseen", "named-callback-in-setup",
    "setup-promise-rejects", "async-handler-destructured-uncaught", "effect-reads-failing-memo-at-root",
    "props-interface-live", "props-accessor-callers", "callback-prop-forwarded", "setup-promise-caught",
    "async-memo-nested-function", "recursion-failing-prop", "return-null", "finally-nested-function"
  ].map(row => /** @type {TableOrigin} */ ({ id: row, kind: "table", file: "packages/vite-plugin-yield/test/native-paths.test.js", table: "programs", row })),
  // packages/vite-plugin-yield/test/native-forms.test.js — `programs`
  ...[
    "getter-read-in-setup", "iife-pending-root", "array-callback-in-setup", "plain-callback-throw-in-memo",
    "plain-callback-throw-under-errored", "kept-promise-rejects-at-its-await", "kept-promise-caught-by-its-chain",
    "untrack-in-every-host", "reader-helpers"
  ].map(row => /** @type {TableOrigin} */ ({ id: row, kind: "table", file: "packages/vite-plugin-yield/test/native-forms.test.js", table: "programs", row }))
]);
