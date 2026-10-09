import {
  createMemo,
  createSignal,
  createRenderEffect,
  getOwner,
  onCleanup,
  runWithOwner
} from "solid-js";
import { createFrame, createFrameHost, createServerComponentHandler } from "@solidjs/web/frames";
import { configureServerFunctionsClient } from "@solidjs/web/server-functions";
export function installHosted() {
  const host = createFrameHost();
  const elements = new Map(
    [...document.querySelectorAll("main[data-fid]")].map(el => [el.getAttribute("data-fid"), el])
  );
  const registry = globalThis._$SC;
  registry.impl = (id, props, binding) => {
    const owner = getOwner(),
      el = elements.get(id) ?? document.createElement("main"),
      adopted = elements.delete(id);
    let release, setGate;
    const arm = () => new Promise(resolve => (release = resolve)),
      initialGate = adopted ? undefined : arm();
    const frame = createFrame(el, {
      host,
      id: binding ? binding() : id,
      adopt: adopted,
      ownerScope: fn => runWithOwner(owner, fn),
      onApply() {
        release?.();
        release = undefined;
        setGate?.(undefined);
      }
    });
    const [gatePromise, writeGate] = createSignal(release ? initialGate : undefined);
    setGate = writeGate;
    el.removeAttribute("data-fid");
    if (binding)
      createRenderEffect(binding, (address, previous) => {
        if (previous !== undefined && address !== previous) writeGate(arm());
        frame.rebind(address);
        el.removeAttribute("data-fid");
      });
    onCleanup(() => frame.dispose());
    const gate = createMemo(() => gatePromise());
    return createMemo(() => (gate(), el));
  };
  const handler = createServerComponentHandler({
    host,
    component: id => registry.r(id),
    intercept: ({ id }) => (elements.has(id) ? true : undefined)
  });
  for (const [address, id] of Object.entries(registry.a ?? {})) handler.showing(address, id);
  registry.reg = (address, id) => handler.showing(address, id);
  configureServerFunctionsClient({ responseHandler: handler });
}
