import { createMemo, Errored, Loading, useContext } from "solid-js";
import { EquipmentContext } from "../service";
import { message } from "../model";
export function Detail(props: { id: string; onClose: () => void }) {
  const service = useContext(EquipmentContext);
  const item = createMemo(() => { service.revision(); return service.api.detail(props.id); });
  return <aside class="panel detail" aria-label="Equipment details"><div class="row-head"><h2>Equipment details</h2><button class="secondary" onClick={props.onClose}>Close</button></div>
    <Errored fallback={(error, reset) => <div role="alert"><p>{message(error())}</p><button onClick={() => { service.reload(); reset(); }}>Retry details</button></div>}>
      <Loading fallback={<p role="status">Loading details…</p>}><h3>{item().name}</h3><dl><dt>Home</dt><dd>{item().location}</dd><dt>Status</dt><dd>{item().status}</dd><dt>Care notes</dt><dd>{item().notes || "No notes yet."}</dd></dl></Loading>
    </Errored>
  </aside>;
}
