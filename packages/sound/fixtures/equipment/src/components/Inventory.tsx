import { createMemo, createSignal, For, useContext } from "solid-js";
import { EquipmentContext } from "../service";
import { isStatus } from "../model";
import type { Status } from "../model";
import { EquipmentRow } from "./EquipmentRow";
export function Inventory(props: { onSelect: (id: string) => void }) {
  const service = useContext(EquipmentContext);
  const [query, setQuery] = createSignal("");
  const [status, setStatus] = createSignal<Status | "all">("all");
  const filtered = createMemo(() => service.list().filter(item =>
    (status() === "all" || item.status === status()) && `${item.name} ${item.location}`.toLowerCase().includes(query().toLowerCase())));
  function filterStatus(event: Event & { currentTarget: HTMLSelectElement }): void {
    const value = event.currentTarget.value;
    if (value === "all" || isStatus(value)) setStatus(value);
  }
  return <section aria-label="Inventory">
    <div class="summary"><strong>{service.list().length} total</strong><span>{service.list().filter(item => item.status === "available").length} available</span><span>{service.list().filter(item => item.status === "checked-out").length} checked out</span><span>{service.list().filter(item => item.status === "maintenance").length} in maintenance</span></div>
    <div class="filters panel"><label>Search equipment<input type="search" value={query()} placeholder="Name or location" onInput={e => setQuery(e.currentTarget.value)} /></label>
    <label>Filter status<select value={status()} onChange={filterStatus}><option value="all">All statuses</option><option value="available">Available</option><option value="checked-out">Checked out</option><option value="maintenance">Maintenance</option></select></label></div>
    <p class="muted">{filtered().length} matching items</p>
    <div class="equipment-list"><For each={filtered().map(item => item.id)} fallback={<p class="panel empty">No equipment matches. Change the filters or add an item.</p>}>{id => <EquipmentRow id={id} onSelect={props.onSelect} />}</For></div>
  </section>;
}
