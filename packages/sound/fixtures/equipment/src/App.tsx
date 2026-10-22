import { createSignal, Errored, Loading, Show } from "solid-js";
import { createApi } from "./api";
import type { EquipmentApi } from "./api";
import { createEquipmentService, EquipmentContext } from "./service";
import { message } from "./model";
import { Inventory } from "./components/Inventory";
import { CreateForm } from "./components/CreateForm";
import { Detail } from "./components/Detail";
import { FailureControls } from "./components/FailureControls";
export function App(props: { api?: EquipmentApi }) {
  const service = createEquipmentService(props.api ?? createApi());
  const [selected, setSelected] = createSignal("");
  return <EquipmentContext value={service}><main>
    <header><div><p class="eyebrow">SHARED RESOURCES / EQUIPMENT DESK</p><h1>Ready for the next project.</h1><p>Find your kit, check it out, and keep the team moving.</p></div><button class="secondary" onClick={service.reload}>Refresh inventory</button></header>
    <FailureControls />
    <p class="notice" role="status">{service.notice()}</p>
    <div class="workspace"><div>
      <Errored fallback={(error, reset) => <section class="panel" role="alert"><h2>Inventory unavailable</h2><p>{message(error())}</p><button onClick={() => { service.reload(); reset(); }}>Retry inventory</button></section>}>
        <Loading fallback={<p class="panel" role="status">Loading inventory…</p>}><Inventory onSelect={setSelected} /></Loading>
      </Errored>
    </div><div class="sidebar"><Show when={selected()}>{id => <Detail id={id()} onClose={() => setSelected("")} />}</Show><CreateForm title="Add to the equipment desk" /><CreateForm title="Add to the field kit" /></div></div>
    <footer>Team equipment desk · Demo data stays in this tab. Each form and row keeps its own draft.</footer>
  </main></EquipmentContext>;
}
