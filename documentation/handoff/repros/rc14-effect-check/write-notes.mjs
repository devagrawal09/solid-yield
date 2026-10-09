import {readFileSync,writeFileSync} from 'node:fs';
const sha='d5d96aa23cc775a8d0d32beea1340b0059d11495';
const repro=readFileSync('/private/tmp/rc14-effect-check/repro.mjs','utf8');
writeFileSync('documentation/upstream/solid-errored-fallback-rc14.md',`# [2.0.0-rc.14] A separate isPending reader hides an async memo rejection from Errored

Status: **draft, not filed** (2026-10-08).

## Summary

A client memo first returns an empty array, then an async iterable whose next()
rejects. Beneath Errored, one render reader displays latest(data).length and a
separate render reader observes isPending(data). On rc.13 the rejection renders
the error fallback once. On rc.14 the DOM stays at 0 and the fallback is never
called. Removing the isPending reader makes rc.14 render the error correctly.

The reproduction uses only public Solid APIs and jsdom. No JSX, compiler,
router, Effect package, Show, Loading, hydration or SSR is involved. A promise
in place of the async iterable also reproduced the failure in the reduction.

## Reproduction

In a fresh directory, install one version pair:

\`\`\`sh
npm install --save-exact solid-js@2.0.0-rc.13 @solidjs/web@2.0.0-rc.13 jsdom@25.0.1
# Then repeat in a separate directory with both Solid packages at rc.14.
node --conditions=browser repro.mjs
node --conditions=browser --conditions=development repro.mjs
\`\`\`

Save this exact tested source as repro.mjs:

\`\`\`js
${repro}\`\`\`

## Expected / actual

**Expected:** the rejected memo reaches Errored and displays ERROR: Search
failed. isPending is only another observer; it must not suppress another
reader's error. This is the rc.13 behavior and the rc.14 behavior with that
observer removed.

**Actual:** rc.14 displays the previous value's length, 0, and never invokes
the fallback. The promise rejection is consumed; the process exits normally.

| Version | Conditions | Output |
| --- | --- | --- |
| rc.13 | browser / production | {"text":"ERROR: Search failed","fallbackCalls":1} |
| rc.13 | browser + development | {"text":"ERROR: Search failed","fallbackCalls":1} |
| rc.14 | browser / production | {"text":"0","fallbackCalls":0} |
| rc.14 | browser + development | {"text":"0","fallbackCalls":0} |

The same source was run against separate package trees for each version,
linked to the retained published packages. No runtime patch was present in
these four runs. Remove the createRenderEffect call that observes isPending
for a control: both versions render the error. Combining the two reads into
one render-effect compute also allowed rc.14's fallback in a larger reduction.

## Cause and source comparison

Paths and lines below refer to the published development dist files.

- solid-js/dist/solid.dev.js:1536 (rc.13) and :1488 (rc.14): Errored's wrapper
  is byte-identical. It delegates to createErrorBoundary and invokes the
  supplied fallback. @solidjs/web re-exports it from solid-js; there is no
  changed web-specific Errored implementation.
- @solidjs/signals/dist/dev.js:10124 (rc.13) calls createCollectionBoundary;
  :8798 (rc.14) calls the new createBoundary. The boundary implementation
  changed, but this does not by itself locate the lost error.
- rc.13's latest path goes through latestRead (:1435) and its shadow memo
  (getLatestValueComputed, :1382). rc.14 replaces it with verdictValue
  (:1155); latest and isPending install that same read dispatcher (:1086,
  :1099).
- rc.14 verdictValue checks CONFIG_HELD at :1205 and returns the committed
  value before its STATUS_ERROR throw at :1270. The held-value returns are
  :1223 and :1234. Its own comment at :1154 says an errored derivation throws
  for every reader, which this path fails to do.

**Verified cause in this reproduction:** a diagnostic copy of rc.14 logged
this memo during the latest read with STATUS_ERROR (flags 2), CONFIG_HELD set,
error message Search failed and committed value []. The held branch returns
that array without reaching the error check. A scratch-only guard that checks
STATUS_ERROR for a non-probing read before the held branch restores
{"text":"ERROR: Search failed","fallbackCalls":1}. The installed packages
were left unchanged. This isolates the error-check ordering; it is not a
proposed complete fix for the scheduler's other cases.

## Release-note check and classification

Neither the installed solid-js package nor its files include a release
changelog. The published [Solid rc.14 release](https://github.com/solidjs/solid/releases/tag/solid-js%402.0.0-rc.14)
and [signals rc.14 release](https://github.com/solidjs/solid/releases/tag/%40solidjs%2Fsignals%402.0.0-rc.14)
were checked. They describe changes to held reads, latest/isPending and
boundary timing; I found no declared change allowing an async rejection to
skip Errored's fallback. Together with the stated error-read rule, the A/B
result and the diagnostic guard, this is a **client regression**, rather than
a demonstrated intentional change in error handling.

## Versions

- solid-js and @solidjs/web: 2.0.0-rc.13 versus 2.0.0-rc.14.
- @solidjs/signals: corresponding rc.13 / rc.14, resolved through solid-js.
- jsdom: 25.0.1; Node: v24.18.0; macOS arm64.
- Both production and development browser conditions tested.
- No issue was filed and no maintainer confirmation is claimed.
`);
let r=readFileSync('documentation/upstream/solid-rc14-retest.md','utf8');
r=r.replace('Status: **candidate blocked; no commit or push**.', 'Status: **committed on chore/rc14; two known red steps allowed on this branch only**. Main stays at 4de2d47; nothing was pushed.');
r=r.replace('The server-only array wrapper from 046387b was removed from perform in the\nworking tree.', 'The server-only array wrapper from 046387b was removed from perform in\n'+sha+'.');
r=r.replace('There is no removal commit SHA yet:\nthe full gate must be green before a commit.', 'Removal commit: '+sha+'. The later ruling allows the two known red gate steps on chore/rc14 only.');
r=r.replace('The candidate stays uncommitted because a GREEN gate is required before every\ncommit.', 'The later ruling permits these two red steps on chore/rc14 only. The candidate\nis committed there; main is not advanced.');
r=r.replace('## Executed bytes','## Effect diagnosis — rc.14 follow-up\n\n**(a) Solid regression.** A standalone plain-Solid client repro under\n/private/tmp/rc14-effect-check needs only Errored, an async memo, latest and\na separate isPending render reader; it needs no JSX/compiler, router, Effect,\nShow or Loading. rc.13 renders ERROR: Search failed once; rc.14 leaves 0 and\ncalls the fallback zero times, in production and development. Removing the\nisPending reader restores rc.14\'s fallback. Instrumentation confirms a held\nsource already in STATUS_ERROR returns its committed [] before verdictValue\nreaches its error check. The standalone [issue draft](solid-errored-fallback-rc14.md)\ncontains the exact source, outputs, changed code and release-note check. Status:\n**draft, not filed**.\n\n**The twin also fails.** Its own app.test.tsx error-recovery test, run without\nthe parity test or original, fails at line 109 because .error-box p is absent\n(one test failed; eleven unrelated tests skipped by -t). The prior 44/46 count\nincludes twin:effect-yield:test among the two red steps; it is not evidence\nthat the twin passed. latestOf / isPendingOf delegate directly to Solid\'s\nlatest / isPending (runtime.ts:449,458), so the library supplies no workaround\nfor this error-read ordering. Both applications remain unchanged.\n\n## Executed bytes');
r=r.replace('| docs-yield |', '| effect-yield | unavailable | unavailable | authored script stops at missing retry button | same blocked script |\n| docs-yield |',1);
r+='\n**Compiler measurements:** C3b/C3c, including the 25.6 KB gzip break-even,\nare **rc.13 figures**. They need re-measurement on rc.14 before using them\nfor current runtime comparisons. They were not re-measured in this task.\n';
writeFileSync('documentation/upstream/solid-rc14-retest.md',r);
const dpath='documentation/DECISIONS.md';
let d=readFileSync(dpath,'utf8');
d=d.replace('The `046387b` array-wrapper workaround is removed in the working tree, its unchanged test and streamed `/profile` pass. **Removal commit pending:** the final rc.14 build passes but the full gate is 44/46 RED (`twin:effect-yield:test`, `twins:executed-bytes`), so no SHA may be recorded yet.', ()=>'**#3815 fixed in rc.14; workaround removed at '+sha+'.** Its unchanged test and streamed `/profile` pass. The final rc.14 build passes; the full gate is 44/46 RED (`twin:effect-yield:test`, `twins:executed-bytes`). **Later ruling (2026-10-08):** these two red steps are allowed on `chore/rc14` only; main remains at `4de2d47`.');
d=d.replace('The unchanged plain-Solid Effect original loses its retry-error fallback on rc.14; rc.13 controls recover it.', ()=> 'The unchanged plain-Solid Effect original and library twin lose their retry-error fallback on rc.14; rc.13 controls recover it. A smaller plain-Solid reproduction isolates a held errored memo returning its previous value in `latest` before the error check, when separately observed by `isPending`: [draft, not filed](upstream/solid-errored-fallback-rc14.md).');
writeFileSync(dpath,d);
let h=readFileSync('HANDOFF.md','utf8');
h=h.replace('## Solid rc.14 candidate — commit blocked (2026-10-08)','## Solid rc.14 — isolated on chore/rc14 (2026-10-08)');
h=h.replace('working tree and its retained test plus 14 rendering SSR cases pass.', sha+' and its retained test plus 14 rendering SSR cases pass.');
h=h.replace('No commit or push; existing thresholds are\nunchanged.', 'The two red steps are allowed on chore/rc14 only; main stays at 4de2d47.\nNo push; existing thresholds are unchanged. Both Effect apps fail; the reduced\nplain-Solid [draft](documentation/upstream/solid-errored-fallback-rc14.md) isolates\nlatest serving a held errored memo\'s prior value when isPending observes it.');
h=h.replace('its candidate remains uncommitted because the gate is red.', 'its candidate is isolated on chore/rc14 under the later ruling allowing the two known red steps there only.');
h=h.replace('is removed in the working tree, its test and rendering SSR pass. Removal commit is blocked by the separate Effect regression (D-082).','was removed at '+sha+', its test and rendering SSR pass. The candidate is isolated on chore/rc14 because both Effect apps fail (D-082).');
h=h.replace('This is an uncommitted candidate until the full gate is green.', 'This candidate is isolated on chore/rc14; its two known red steps are allowed there only. Main remains at 4de2d47.');
h=h.replace('Workaround removal is uncommitted until the rc.14 gate passes.', 'Workaround removal is committed at '+sha+' on chore/rc14; main remains at 4de2d47.');
h=h.replace('workaround removal is pending a green commit;', 'workaround removal is committed on chore/rc14 only;');
writeFileSync('HANDOFF.md',h);
let m=readFileSync('documentation/upstream/solid-ssr-memo-loop-rc13.md','utf8');
m=m.replace('The `046387b` workaround is removed in the working tree and its unchanged test plus `/profile` SSR pass; commit is blocked by the separate rc.14 Effect regression.', 'The `046387b` workaround was removed at '+sha+' on chore/rc14. Its unchanged test plus `/profile` SSR pass; the separate rc.14 Effect regression keeps this branch off main.');
writeFileSync('documentation/upstream/solid-ssr-memo-loop-rc13.md',m);
console.log('Draft and branch records saved; D-082 names the removal commit.');
