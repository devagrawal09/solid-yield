import { createSignal } from "solid-js";
import type { Client } from "./client";

// Unhandled rejection in an event: should be EVENT_REJECTS (unknown).
export function NoCatch(props: { api: Client }) {
  const [last, setLast] = createSignal("");
  const handleCreate = async () => {
    const res = await props.api.session.create({ body: {} });
    setLast(res.data?.id ?? "none");
  };
  return <button onClick={handleCreate}>{last()}</button>;
}
