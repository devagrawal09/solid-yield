# D-133 runtime evidence (Solid 2.0.0-rc.17)

Fresh tests: test/openclaw-precision-runtime.test.tsx, using this package's
Vitest, Solid compiler and jsdom setup. All seven pass. Strict TypeScript validation
of all 30 fixtures, plus the installed TSX probe, also passes against this
package's TypeScript and rc.17 declarations (openclaw-precision-contract.test.mjs).

| Test | Observed result |
|---|---|
| Loading reset inputs | changing a settled signal key keeps ready children; no STRICT_READ_UNTRACKED warning; a function held as a reset key is never invoked |
| Actual pending read outside Loading | rc.17 emits ASYNC_OUTSIDE_LOADING_BOUNDARY for a pending sibling; content renders after fulfillment |
| merge default and override | a known safe override is safe; a throwing supplied override still throws despite a no-op default |
| Focus-repair microtask | after removing the focused button, native Array.find skips disconnected/missing destinations and focuses the connected button |
| Safe callback/ref forwarding | the input ref captures its node through two forwarding steps; the event callback runs only on click |
| Imperative machine in effect apply | synchronous get/hasTag/computed/start/subscribe run without a pending-read error |
| Actual async read inside a class method | changing start to read a pending memo really throws in apply; class calls cannot be blanket-silenced |

**No agreed reviewer FALSE POSITIVE verdict was overturned.** The four disputed
findings E24/E28/E30/E40 remain true contract obligations under the binding D-129
rule, not a runtime downgrade or evidence of an observed production exception.
The pending-sibling test guards a real mutant currently missed by both B and C.

For the class mutant, rc.17 reports PENDING_ASYNC_UNTRACKED_READ. The static
fixture retains D-131's existing PENDING_ASYNC_FORBIDDEN_SCOPE policy for effect
apply; the runtime code difference is recorded here rather than hidden. This
does not change the agreed FP verdict for synchronous machine calls.

The machine test isolates method/read classification using the frozen effect
apply phase; it does not decide onSettled ownership. Reset ordering, ref cleanup
and the other FUTURE.md rules remain deferred. Runtime tests execute only authored
reductions. Copied OpenClaw sources and the fake installed package are never run.

Commands (from packages/sound):

    pnpm exec vitest run test/openclaw-precision-contract.test.mjs test/openclaw-precision-runtime.test.tsx
    node harness/openclaw-precision-baseline.mjs
    node harness/run.mjs
    pnpm test

The exact baseline is separate from runtime evidence: current false errors remain
visible in results/openclaw-precision-baseline.md and openclaw-precision-known.json.
