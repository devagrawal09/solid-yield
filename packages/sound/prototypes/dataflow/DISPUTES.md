# Dataflow expectation disputes

## D-133 reset-key mutant has no render root

`fixtures/openclaw-precision/op-loading-reactive-key-mutant.tsx` exports App,
which returns a pending read beside a Loading boundary. It never renders App
or hands it off. Its frozen expectation asks for ASYNC_OUTSIDE_LOADING_BOUNDARY.

SLICE.md, **Roots and hand-offs**, explicitly says an export that is never
rendered or handed off is **not an error**. It requires
COMPONENT_OBLIGATIONS_EXPORTED instead. The fixture entry field is not a render
root in CONTRACT.md; the checker receives rootDir/files, not entry metadata.
Treating every exported component as a root would also break the existing
export-only controls. Testing a component through an implicit harness renderer
would change the contract rather than fix the analysis.

B therefore keeps the info finding and the pending component fact. The raw
frozen score remains **one miss / one soundness failure / one missed mutant**.
It is not filtered or called a pass. No expectation or shared file was edited.
The old ref dispute below is historical; the current frozen ref expectation
already includes its setup-like read error.

### rc.17 runtime evidence

`prototypes/dataflow/precision-runtime.test.tsx` uses installed
Solid/@solidjs/web 2.0.0-rc.17, the shared Solid compiler plugin, development
browser exports and jsdom. The same exported pending-view shape:

- never rendered: no work, DOM, or root-pending warning;
- rendered under an outer Loading: resolves to ready with no
  ASYNC_OUTSIDE_LOADING_BOUNDARY warning;
- rendered without an outer Loading: emits that warning.

`precision.test.mjs` checks the matching static distinction: unrendered export
gives only COMPONENT_OBLIGATIONS_EXPORTED; adding a real renderer reports
ASYNC_OUTSIDE_LOADING_BOUNDARY at the pending read.

```sh
pnpm exec vitest run prototypes/dataflow/precision-runtime.test.tsx prototypes/dataflow/precision.test.mjs
```

Both runtime probes pass. Reaching the requested raw 15/15 requires a reviewed
expectation change or an explicit change to the root contract.


## Legacy ref read versus D-131

`fixtures/cases/ref-event-reads.tsx` contains:

```tsx
const [n, set] = createSignal(1);
return <div ref={el => { set(n() + el.childElementCount); }}>{n()}</div>;
```

The frozen original expectation requires a partial-check warning at the ref and
no error. D-131 now requires STRICT_READ_UNTRACKED at every settled reactive
read in a ref callback. That includes `n()`, even when its value feeds a setter.
Treating that read as an event-handler read would hide the same fault the new
ref mutants require us to report. No fixture-specific exception is sound.

Dataflow retains the required UNANALYZED_BOUNDARY warning for the still-deferred
ref write ownership question. It also reports one STRICT_READ_UNTRACKED error
at `n()`. This is the sole remaining scored extra, not a false positive under
D-131. Neither expectation nor shared code was changed.

### Runtime evidence

`prototypes/dataflow/ref-runtime.test.tsx` compiles the same ref read-modify-write
shape with installed Solid/@solidjs/web 2.0.0-rc.17 and the shared Vite Solid
plugin, browser development exports and jsdom. Run:

```sh
pnpm exec vitest run prototypes/dataflow/ref-runtime.test.tsx
```

Observed: the ref runs once; getObserver() is nullish inside it. Updating n
from 1 to 2 updates the returned JSX to 2 but does not rerun the ref. rc.17
emits no runtime warning because the compiler intentionally untracks refs.
D-131 is a static read-scope rule, not a promise that this runtime warning fires.
This agrees with the frozen runtime ref probe in test/openclaw-runtime.test.tsx.

The earlier broad ref warning was removed for supported DOM capture/assignment
and read-only callbacks. Reactive writes in refs still warn because D-131 does
not settle ref ownership; the write result remains worst case. No extra warning
is retained on the new clean controls.
