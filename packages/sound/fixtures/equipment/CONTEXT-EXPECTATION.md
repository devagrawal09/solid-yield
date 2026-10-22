# Equipment Checkout — context/services expectation

This supersedes EXPECTATION.md for CONTEXT.md; that file preserves the old slice
baseline. All ten src/ files stay byte-identical. Registry: fixtures/index.mjs.

## Precise service facts

App 11 calls createEquipmentService during setup. service.ts 20–22 creates two
settled signals (revision/notice) and list, an async memo reading revision and
calling api.list(). list can be pending and can fail; notice/revision cannot.
reload (23) only updates revision, so is failure-free. commit (24–36) awaits the
request inside try/catch, runs reload and sets notice, and returns a Result even
on failure. create/update/status/remove (38–41) all call commit; their Promises
do not reject from API failures. Creating this service and providing/consuming
it is supported, with no UNANALYZED_BOUNDARY warning.

App’s optional EquipmentApi is a public injection point. Its plain function types
do not state failures, and the injected arm stays unknown (D-129), even though
main.tsx omits it in the demo. createApi’s bodies do not license trusting a different
injected object. service.api retains that uncertainty; commit still handles it.

## Expected errors (10)

All are UNHANDLED_HANDLER_FAILURE. The primary handler locations are:

| source | why it can fail outside a catch |
|---|---|
| EquipmentRow 44, onClick={edit} | edit at 14 reads item(), derived at 6 from list. A failing async memo read throws; the rendered Errored cannot catch it. Keep this real hole. |
| EquipmentRow 45, onChange={changeStatus} | at 26, item()?.status reads the same possibly failing memo before the try/finally. status’s Promise is handled by commit, but this read is not. |
| FailureControls 9, arm("list") button | arm at 7 calls injected api.failNext with no failure information. |
| FailureControls 9, arm("detail") button | same unknown call, independent handler. |
| FailureControls 9, arm("create") button | same unknown call, independent handler. |
| FailureControls 9, arm("update") button | same unknown call, independent handler. |
| FailureControls 9, arm("status") button | same unknown call, independent handler. |
| FailureControls 9, arm("delete") button | same unknown call, independent handler. |
| FailureControls 9, setLatency(800) button | injected plain function; unknown throw, no catch. |
| FailureControls 9, setLatency(240) button | same unknown call, independent handler. |

Two independent PENDING_ASYNC_IN_HANDLER warnings occur at EquipmentRow 14
item() and 26 item()?.status. They can read before initialization. Optional
chaining does not avoid evaluating the accessor. Loading around Inventory does
not protect these handler reads; failing and pending obligations are separate.

## The eight old worst-case errors that disappear

| old location | precise reason it is clean |
|---|---|
| App 13 service.reload handler | only a settled signal setter |
| App 15 service.notice, pending | settled string signal, not an async source (the old error moves to warn under D-129 before this context refinement removes it) |
| App 15 service.notice, failure | plain settled signal does not fail |
| App 17 retry handler | reload and Errored reset are failure-free |
| CreateForm 19 submit | service.create calls commit, which catches API failures; try/finally in the form is not itself a catch, but no rejection escapes commit |
| EquipmentRow 48 save | update calls commit; name/location/notes are settled signals, id is held |
| EquipmentRow 46 remove | remove calls commit; no item read |
| Detail 8 retry handler | reload/reset never fail |

The seven old factory/provider/useContext partial-check warnings disappear.

## Other obligations discharged, not deleted

Inventory list/filtered and EquipmentRow item reads in JSX still carry pending
and failure: App 17–19 encloses Inventory in Errored then Loading. Detail’s memo
(6) reads settled revision and calls the possibly rejecting api.detail, but all
rendered item reads are under Detail’s own Errored/Loading (8–9). FailureControls
armed and CreateForm/EquipmentRow draft/busy/error signals are settled.

Detail onClose and EquipmentRow onSelect resolve through Inventory to App’s
setSelected or () => setSelected(""): failure-free, no false callback error. All
useContext sites have the App 12 provider, including both CreateForm instances.
App’s notice lies outside Loading/Errored, but is now correctly clean. No failure
contract or suppression was added; unchanged prototypes may still over-report.
