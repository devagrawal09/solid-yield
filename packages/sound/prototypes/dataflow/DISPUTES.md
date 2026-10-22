# Dataflow expectation dispute

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
