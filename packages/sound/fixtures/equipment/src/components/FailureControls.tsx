import { createSignal, useContext } from "solid-js";
import { EquipmentContext } from "../service";
import type { Operation } from "../model";
export function FailureControls() {
  const service = useContext(EquipmentContext);
  const [armed, setArmed] = createSignal("");
  function arm(operation: Operation): void { service.api.failNext(operation); setArmed(`Next ${operation} request will fail once.`); }
  return <details class="panel diagnostics"><summary>Request simulator</summary><p>Requests take 240 ms by default. A failure is consumed by the next matching request.</p>
    <div class="actions"><button class="secondary" onClick={() => arm("list")}>Fail next list</button><button class="secondary" onClick={() => arm("detail")}>Fail next detail</button><button class="secondary" onClick={() => arm("create")}>Fail next create</button><button class="secondary" onClick={() => arm("update")}>Fail next update</button><button class="secondary" onClick={() => arm("status")}>Fail next status</button><button class="secondary" onClick={() => arm("delete")}>Fail next delete</button><button class="secondary" onClick={() => service.api.setLatency(800)}>Use 800 ms latency</button><button class="secondary" onClick={() => service.api.setLatency(240)}>Use 240 ms latency</button></div><p role="status">{armed()}</p>
  </details>;
}
