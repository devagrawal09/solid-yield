# rc.17 runtime verification — D-131

`pnpm exec vitest run test/openclaw-runtime.test.tsx`: 11 tests passed.
Uses packages/sound/node_modules solid-js / @solidjs/web 2.0.0-rc.17,
@solidjs/vite-plugin 3.0.0-next.51, development browser exports and jsdom.
No upstream OpenClaw program or test was run. vitest.config.mjs adds the
minimal JSX/browser setup; jsdom is already installed in the workspace.

| Check | Observed result |
|---|---|
| Key-function For row | Body runs once for a retained key. Reading row() and another signal there does not subscribe. getObserver() is nullish. Updating both changes returned JSX, not the snapshot/body. |
| Default For | Raw item, accessor index; body untracked. New object identity creates a new row. Unrelated signal updates update JSX without rerunning body. |
| Index mode | For keyed={false}: accessor item, numeric index. Same position keeps body/snapshot while JSX follows replacement. rc.17 exports no Index component. |
| Ref callback | Called once at mount, nullish observer. Signal change updates JSX, not the callback/snapshot. |
| Effect compute/apply | Compute forwards A then B to helper. Apply reading a reactive prop snapshots A, never subscribes, and emits STRICT_READ_UNTRACKED at runtime. Static error under D-130. |
| Context default | In a reactive root, explicit undefined throws at lookup; null is usable. Default accessor is copied without evaluation. Provider accessor shadows default. |
| Unused prop | A lazy prop getter is never demanded by an unused consumer. Its throwing memo may still compute eagerly; do not confuse compute scheduling with consumer demand. |
| Fulfilled outcome | A fulfilled error-field record is turned into a synchronous memo throw. Child Loading/Errored renders failed after settlement. rc.17 also logs the caught Error. |
| Promise fork | Catching original resolves only that observer; its derived branch still rejects. Test attaches a rejection assertion so no unhandled test rejection is created. |
| untrack | Project throw still escapes unless locally caught. |

Initial test corrections: context lookup probes must run under createRoot;
count prop getter demands rather than eager memo computes. These test mistakes
do not change fixture expectations. No discrepancy with the D-131 row/ref rule
was found. Pending row/ref expectations follow the existing pending-untracked
read law; the runtime timing tests use settled signals to isolate scope.
