import { createMemo, createSignal, Show, useContext } from "solid-js";
import { EquipmentContext } from "../service";
import { isStatus } from "../model";
export function EquipmentRow(props: { id: string; onSelect: (id: string) => void }) {
  const service = useContext(EquipmentContext);
  const item = createMemo(() => service.list().find(item => item.id === props.id));
  const [editing, setEditing] = createSignal(false);
  const [name, setName] = createSignal("");
  const [location, setLocation] = createSignal("");
  const [notes, setNotes] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  function edit(): void {
    const current = item();
    if (current) { setName(current.name); setLocation(current.location); setNotes(current.notes); setEditing(true); }
  }
  const save = async (event: SubmitEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await service.update(props.id, { name: name().trim(), location: location().trim(), notes: notes() });
      if (result.ok) setEditing(false); else setError(result.message);
    } finally { setBusy(false); }
  };
  const changeStatus = async (event: Event & { currentTarget: HTMLSelectElement }) => {
    const select = event.currentTarget;
    const previous = item()?.status;
    const next = select.value;
    if (!isStatus(next)) return;
    setBusy(true); setError("");
    try {
      const result = await service.status(props.id, next);
      if (!result.ok) { setError(result.message); if (previous) select.value = previous; }
    }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true); setError("");
    try { const result = await service.remove(props.id); if (!result.ok) setError(result.message); }
    finally { setBusy(false); }
  };
  return <Show when={item()}>{current => <article class="equipment panel" aria-label={current().name}>
    <Show when={editing()} fallback={<>
      <div class="row-head"><div><h3>{current().name}</h3><p>{current().location}</p></div><span class="badge">{current().status}</span></div>
      <div class="actions"><button class="secondary" onClick={() => props.onSelect(props.id)}>Details</button><button class="secondary" onClick={edit}>Edit</button>
      <label class="status-control">Status<select aria-label="Status" value={current().status} disabled={busy()} onChange={changeStatus}><option value="available">Available</option><option value="checked-out">Checked out</option><option value="maintenance">Maintenance</option></select></label>
      <button class="danger" disabled={busy()} onClick={remove}>Delete</button></div>
    </>}>
      <form aria-label={`Edit ${current().name}`} onSubmit={save}>
        <label>Name<input required value={name()} onInput={e => setName(e.currentTarget.value)} /></label>
        <label>Location<input required value={location()} onInput={e => setLocation(e.currentTarget.value)} /></label>
        <label>Notes<textarea value={notes()} onInput={e => setNotes(e.currentTarget.value)} /></label>
        <div class="actions"><button type="submit" disabled={busy()}>{busy() ? "Saving…" : "Save"}</button><button class="secondary" type="button" disabled={busy()} onClick={() => setEditing(false)}>Cancel</button></div>
      </form>
    </Show><p role="alert">{error()}</p>
  </article>}</Show>;
}
