# Disputes

## ref-event-reads: the old read expectation conflicts with D-131

The frozen original fixture is outside the subset and requires only
UNANALYZED_BOUNDARY at its ref. Its registry note says the callback is
handler-like and its reads are fine. D-131 now requires setup-like read checks
in ref callbacks, including this callback's n() at line 1, column 117.

C reports STRICT_READ_UNTRACKED there. That is the only remaining scored extra
in all 143 fixtures. Removing it would contradict D-131 and miss the same read
in the new ref mutants. No path, fixture name, text or expectation participates
in the checker. The older fixture and its tests remain unchanged, so the strict
no-extra assertion in test/oxc.test.mjs fails for this one case.

Runtime evidence: prototypes/oxc/ref-runtime.test.jsx runs compiled JSX with
installed rc.17 and jsdom. Its ref reads and writes a signal, as the old fixture
does. After an external update to 4, JSX shows 4, but the callback ran once,
getObserver() was nullish, and its snapshot remains 1. A setter in that callback
does not make the read tracked. The test passes. The frozen runtime ref probe
in test/openclaw-runtime.test.tsx independently confirms the read-only case.

Ref write ownership is still deferred by FUTURE.md. C retains a partial-check
warning at a ref with a reactive write, returns worst case from that write, and
does not invent REACTIVE_WRITE_IN_OWNED_SCOPE for it. This retains the old
required warning. It does not hide the known untracked read.

No other expectation disputes. Callback-prop failure sets remain body-wide,
including forwarded callbacks, as the shared contract requires.
