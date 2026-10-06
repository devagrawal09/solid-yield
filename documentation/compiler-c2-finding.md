# C2 public-API spike: delayed root claims

## F-C5: delayed hydration replaces the second server root on rc.13

**Status: reproduced; C2 blocked at the public-API spike.**

C0 §3.1 requires namespaces that independent `hydrate(..., { renderId })` calls
claim, and says “If it does not, that is a finding (D-004), and C2 waits for Dev”.
Dev's Q1-C ruling also requires per-root claims, including delayed roots.

The fixture server-renders two library-runtime counters under public
`NoHydration` / `Hydration({ id })`, with an inert heading between their shell
and the document. Each root's button has its own namespace. It uses the public
hydration script and the library's `hydrate` entry with the matching `renderId`.

| Schedule | First server button retained | Second server button retained | Warnings | Interaction after setup |
| --- | --- | --- | --- | --- |
| Hydrate both synchronously | yes | yes | none | both increment independently |
| Hydrate first; await one timer turn; hydrate second | yes | **no** | **none** | replacement button increments |

The delayed case fails the per-root claim invariant even though the final DOM
looks right. The old second button is disconnected. This rules out treating a
clean console or matching final markup as sufficient evidence of hydration.
No click on the first root is needed to trigger it.

Diagnosis from the installed rc.13 implementation: Solid's
`drainHydrationCallbacks` schedules the page-wide `_$HY.done = true` flag after
the first hydration completes. Web's `hydrate` then takes its plain-render path
when that flag is true. The reproduction observes node identity; it does not
read or modify private runtime state. No private reset or forced eager hydration
has been added as a workaround.

Reproduce: `node --test packages/compiler-yield/test/hydration-namespace.test.mjs`.
The two schedules run in separate processes. The delayed test **pins the finding**
with a failed identity claim; it is not a passing delayed-hydration test. A future
fix that preserves the second node will make that test fail until the finding is
updated deliberately. Source: `test/fixtures/roots.tsx` in the compiler package.

No C2 loader, generated twin, root source map or compiled benchmark is emitted.
A public way to hydrate later independent roots without losing their server
claims is needed before that work can satisfy the ruling.
