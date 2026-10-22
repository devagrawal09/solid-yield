# Disputes

## ref-event-reads: resolved before this precision pass

The earlier OpenClaw pass disputed the original ref-read expectation. The
starting revision for this precision pass already requires both
STRICT_READ_UNTRACKED at n() and the deferred-ownership warning. C meets both,
with no extra. This pass changes neither that fixture nor its expectation.
The evidence below is retained as history, not a current test failure.

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

Callback-prop failure sets remain body-wide, including forwarded callbacks,
as the shared contract requires.

## op-loading-reactive-key-mutant: an export is not a render root

The new fixture exports App but never renders it or hands it off. It expects
ASYNC_OUTSIDE_LOADING_BOUNDARY at read(). SLICE.md, “Roots and hand-offs,”
explicitly says that a merely exported, unrendered component is **not an error**.
Its obligation is COMPONENT_OBLIGATIONS_EXPORTED, at info level. D-133 does not
replace that rule. The checker retains the pending fact and emits that notice.
This remains a scored miss and a missed mutant; neither is filtered or relabeled
as a passing expectation. No frozen fixture or expectation was edited.

Runtime evidence: precision-runtime.test.jsx mounts the same pending-sibling
shape in a caller-provided Loading boundary using installed Solid rc.17 and
compiled JSX. It first renders “outer wait,” then “ready” after resolution, with
no ASYNC_OUTSIDE_LOADING_BOUNDARY warning. The test passes. Thus the component
needs a boundary somewhere above the read, not necessarily inside itself.
The existing frozen runtime probe mounts its version directly as a root; its
root warning is valid, but that renderer is absent from the static fixture.

precision.test.mjs checks all three static cases: export alone gives the info
notice; render(App, document.body) gives the required error at the read; a caller
Loading discharges it. Turning this export alone into an error would break the
shared hand-off rule and reject the runtime-proven safe caller. A rendered
version of this positive fixture would test the intended root obligation.

Command: pnpm exec vitest run prototypes/oxc/precision-runtime.test.jsx
prototypes/oxc/precision.test.mjs. Both new suites pass.
