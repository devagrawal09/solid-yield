---
"@solidjs/blocks": patch
---

Development builds of `@solidjs/blocks` now refuse a second copy of the runtime. The runtime's marks are `Symbol.for` keys, so two copies (a duplicated dependency, a bundle that inlined the package next to an external one) used to half-work together: each copy kept its own host state, and a block driven by one failed the other's checks with misleading errors (`READ_IN_SETUP` in a view, `CREATE_OUTSIDE_SETUP` in a setup). Each copy now registers its module URL on `globalThis` when it loads (one key for the client build and one for the server build, so a server render and a hydrating client in one test process are still two runtimes by design), and a second registration from another URL throws `[DUPLICATE_RUNTIME]` naming both URLs, or `(unknown URL)` where `import.meta.url` gives none. The same module evaluated again at its own URL replaces its registration. Production builds do not check.
