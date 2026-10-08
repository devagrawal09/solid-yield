import {
  createMemo,
  createRenderEffect,
  getOwner,
  onCleanup,
  runWithOwner,
  createOwner,
  createSignal
} from "solid-js";
import { insert } from "@solidjs/web";
import { createFrame, createFrameHost, createServerComponentHandler } from "@solidjs/web/frames";
import {
  claimSlot,
  installDocumentBinding,
  seedDocumentSlot,
  documentHosts,
  clearHostMarker
} from "./solid-adapter.js";
import { configureServerFunctionsClient } from "@solidjs/web/server-functions";

// Bounded R adapter: primitive slot inputs, completed document SSR, and normal
// frame responses. Streamed slot inputs and nested server-JSX slots need a
// separate proof before this emitter may accept them.

export function installHostedRegions() {
  const host = createFrameHost();
  const elements = documentHosts();
  const documentBinding = installDocumentBinding((id, props, binding) => {
    const owner = getOwner();
    const el = elements.get(id) ?? document.createElement(props.regionRoot);
    const adopted = elements.delete(id);
    if (!adopted && props.regionRoot === "section") el.className = "reading-guide";
    const address = binding ? binding() : id;
    // Match the public server-component binding: resolving the component from
    // response headers is not enough to settle a navigation. Wait until its
    // root HTML has applied, including when a retained host is rebound.
    let release, setGate;
    const arm = () => new Promise(resolve => (release = resolve));
    const initialGate = adopted ? undefined : arm();
    if (adopted && props.like) seedDocumentSlot(host, id, address);
    const slots = props.like
      ? {
          like(args, ctx) {
            // One route-owned memo supplies both the immediate fallback and the
            // keyed slot. onUpdate retains it when the server changes the slug.
            ctx.onUpdate(() => {});
            const slotOwner = runWithOwner(owner, () => createOwner());
            ctx.onCleanup(() => slotOwner.dispose());
            const render = () => {
              const value = createMemo(() => props.like(args));
              insert(ctx.range.end.parentNode, value, ctx.range.end, [...ctx.existing]);
            };
            runWithOwner(slotOwner, () =>
              adopted ? claimSlot(id, ctx.existing, render) : render()
            );
          }
        }
      : undefined;
    const frame = createFrame(el, {
      id: address,
      host,
      adopt: adopted,
      slots,
      ownerScope: fn => runWithOwner(owner, fn),
      onApply() {
        release?.();
        release = undefined;
        setGate?.(undefined);
      }
    });
    const [gatePromise, writeGate] = createSignal(release ? initialGate : undefined);
    setGate = writeGate;
    // The key is needed only at attach. It must not become a permanent
    // authored-DOM difference, and frame routing does not read it again.
    clearHostMarker(el);
    if (binding)
      createRenderEffect(binding, (address, previous) => {
        if (previous !== undefined && address !== previous) writeGate(arm());
        frame.rebind(address);
        clearHostMarker(el);
      });
    onCleanup(() => frame.dispose());
    const gate = createMemo(() => gatePromise());
    return createMemo(() => (gate(), el));
  });
  const handler = createServerComponentHandler({
    host,
    component: documentBinding.resolve,
    intercept: ({ id }) => (elements.has(id) ? true : undefined)
  });
  documentBinding.connect(handler);
  configureServerFunctionsClient({ responseHandler: handler });
}
