import { createContext, createMemo, createSignal } from "solid-js";
import type { Accessor } from "solid-js";
import type { EquipmentApi } from "./api";
import { message } from "./model";
import type { Draft, Equipment, Result, Status } from "./model";
export interface EquipmentService {
  readonly list: Accessor<readonly Equipment[]>;
  readonly revision: Accessor<number>;
  readonly notice: Accessor<string>;
  readonly api: EquipmentApi;
  reload(): void;
  create(draft: Draft): Promise<Result>;
  update(id: string, draft: Draft): Promise<Result>;
  status(id: string, status: Status): Promise<Result>;
  remove(id: string): Promise<Result>;
}
export const EquipmentContext = createContext<EquipmentService>();
export function createEquipmentService(api: EquipmentApi): EquipmentService {
  const [revision, setRevision] = createSignal(0);
  const [notice, setNotice] = createSignal("");
  const list = createMemo(() => { revision(); return api.list(); });
  function reload(): void { setRevision(value => value + 1); }
  async function commit(request: () => Promise<void>): Promise<Result> {
    try {
      await request();
      reload();
      setNotice("Changes saved.");
      return { ok: true };
    } catch (error) {
      const text = message(error);
      setNotice(text);
      return { ok: false, message: text };
    }
  }
  return { list, revision, notice, api, reload,
    create: draft => commit(() => api.create(draft)),
    update: (id, draft) => commit(() => api.update(id, draft)),
    status: (id, status) => commit(() => api.status(id, status)),
    remove: id => commit(() => api.remove(id))
  };
}
