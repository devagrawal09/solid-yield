import { createSignal, onSettled } from "solid-js";
import type { Client } from "./client";
declare function makeClient(): Client;

// Control: the same call through a client held in a local signal is lowered correctly.
export function SignalHeld() {
  const [api, setApi] = createSignal<Client | null>(null);
  const [last, setLast] = createSignal("");
  onSettled(() => {
    setApi(makeClient());
  });
  const handleCreate = async () => {
    const client = api();
    if (!client) return;
    const res = await client.session.create({ body: {} });
    setLast(res.data?.id ?? "none");
  };
  return <button onClick={handleCreate}>{last()}</button>;
}
