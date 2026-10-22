import { createSignal, useContext } from "solid-js";
import { EquipmentContext } from "../service";
export function CreateForm(props: { title: string }) {
  const service = useContext(EquipmentContext);
  const [name, setName] = createSignal("");
  const [location, setLocation] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await service.create({ name: name().trim(), location: location().trim(), notes: "" });
      if (result.ok) { setName(""); setLocation(""); }
      else setError(result.message);
    } finally { setBusy(false); }
  };
  return <form class="panel create-form" aria-label={props.title} onSubmit={submit}>
    <h3>{props.title}</h3>
    <label>Equipment name<input required value={name()} onInput={e => setName(e.currentTarget.value)} /></label>
    <label>Home location<input required value={location()} onInput={e => setLocation(e.currentTarget.value)} /></label>
    <button disabled={busy()} type="submit">{busy() ? "Adding…" : "Add equipment"}</button>
    <p role="alert">{error()}</p>
  </form>;
}
