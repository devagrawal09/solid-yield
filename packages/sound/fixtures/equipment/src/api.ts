import type { Draft, Equipment, Operation, Status } from "./model";
export interface EquipmentApi {
  list(): Promise<readonly Equipment[]>;
  detail(id: string): Promise<Equipment>;
  create(draft: Draft): Promise<void>;
  update(id: string, draft: Draft): Promise<void>;
  status(id: string, status: Status): Promise<void>;
  remove(id: string): Promise<void>;
  failNext(operation: Operation): void;
  setLatency(milliseconds: number): void;
}
export function createApi(): EquipmentApi {
  let items: Equipment[] = [
    { id: "camera", name: "Studio camera", location: "Media room", status: "available", notes: "Return with lens cap and charged battery." },
    { id: "projector", name: "Portable projector", location: "Meeting room", status: "checked-out", notes: "HDMI cable included." },
    { id: "recorder", name: "Field recorder", location: "Media room", status: "maintenance", notes: "Battery compartment needs inspection." }
  ];
  let nextId = 1;
  let latency = 240;
  const failures = new Set<Operation>();
  async function wait(operation: Operation): Promise<void> {
    const fail = failures.delete(operation);
    await new Promise<void>(resolve => setTimeout(resolve, latency));
    if (fail) throw new Error(`Injected ${operation} failure. Please retry.`);
  }
  function find(id: string): Equipment {
    const item = items.find(item => item.id === id);
    if (!item) throw new Error("Equipment no longer exists.");
    return item;
  }
  function validate(draft: Draft): void {
    if (!draft.name.trim() || !draft.location.trim()) throw new Error("Name and location are required.");
  }
  return {
    async list() { await wait("list"); return items.map(item => ({ ...item })); },
    async detail(id) { await wait("detail"); return { ...find(id) }; },
    async create(draft) { await wait("create"); validate(draft); items = [...items, { ...draft, id: `new-${nextId++}`, status: "available" }]; },
    async update(id, draft) { await wait("update"); validate(draft); find(id); items = items.map(item => item.id === id ? { ...item, ...draft } : item); },
    async status(id, status) { await wait("status"); find(id); items = items.map(item => item.id === id ? { ...item, status } : item); },
    async remove(id) { await wait("delete"); find(id); items = items.filter(item => item.id !== id); },
    failNext(operation) { failures.add(operation); },
    setLatency(milliseconds) { latency = milliseconds; }
  };
}
