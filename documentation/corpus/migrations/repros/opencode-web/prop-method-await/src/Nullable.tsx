import { createSignal } from "solid-js";
import type { Client } from "./client";

// opencode-web SessionList shape: nullable client prop, narrowed, awaited, caught.
export function Nullable(props: { api: Client | null }) {
  const [last, setLast] = createSignal("");
  const handleCreate = async () => {
    if (!props.api) return;
    try {
      const { data } = await props.api.session.create({ body: {} });
      if (data) setLast(data.id);
    } catch (e) {
      setLast("failed");
    }
  };
  return <button onClick={handleCreate}>{last()}</button>;
}
