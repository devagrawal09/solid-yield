import { createSignal } from "solid-js";
import type { Client } from "./client";

// Workaround attempt: copy the prop into a local first. Fully caught.
export function LocalCopy(props: { api: Client }) {
  const [last, setLast] = createSignal("");
  const handleCreate = async () => {
    const api = props.api;
    try {
      const { data } = await api.session.create({ body: {} });
      if (data) setLast(data.id);
    } catch (e) {
      setLast("failed");
    }
  };
  return <button onClick={handleCreate}>{last()}</button>;
}
