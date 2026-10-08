import {
  createMemo,
  createRenderEffect,
  getOwner,
  onCleanup,
  runWithOwner,
  createOwner
} from "solid-js";
import { sharedConfig } from "solid-js/internal";
import { insert } from "@solidjs/web";
import { createFrame, createFrameHost, createServerComponentHandler } from "@solidjs/web/frames";
import { configureServerFunctionsClient } from "@solidjs/web/server-functions";

// Bounded R adapter: primitive slot inputs, completed document SSR, and normal
// frame responses. Streamed slot inputs and nested server-JSX slots need a
// separate proof before this emitter may accept them.
function claimSlot(id, key, existing, render) {
  if (!sharedConfig.hydrating || !existing.length) return render();
  const registry = new Map();
  for (const node of existing) {
    if (node.nodeType !== 1) continue;
    for (const el of [node, ...node.querySelectorAll("[_hk]")])
      if (el.hasAttribute("_hk")) registry.set(el.getAttribute("_hk"), el);
  }
  if (!registry.size) return render();
  const previous = sharedConfig.registry,
    roots = sharedConfig.claimRoots;
  for (const key of registry.keys()) previous?.delete(key);
  sharedConfig.registry = registry;
  sharedConfig.claimRoots = existing;
  try {
    return runWithOwner(createOwner({ id: `sc-${id}-${key}-` }), render);
  } finally {
    sharedConfig.registry = previous;
    sharedConfig.claimRoots = roots;
  }
}

export function installHostedRegions() {
  const host = createFrameHost();
  const elements = new Map();
  for (const el of document.querySelectorAll("main[data-fid],section.reading-guide[data-fid]"))
    elements.set(el.getAttribute("data-fid"), el);
  const registry = globalThis._$SC;
  if (!registry) throw new Error("R requires the document server-component registry");
  registry.impl = (id, props, binding) => {
    const owner = getOwner();
    const el = elements.get(id) ?? document.createElement(props.regionRoot);
    const adopted = elements.delete(id);
    if (!adopted && props.regionRoot === "section") el.className = "reading-guide";
    const address = binding ? binding() : id;
    if (adopted) {
      const prefix = `sc:slot:${id}:`;
      for (const [key, args] of Object.entries(globalThis._$HY?.r ?? {}))
        if (key.startsWith(prefix))
          host.apply({
            type: "slot",
            id: address,
            version: 0,
            key: key.slice(prefix.length),
            args
          });
    }
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
              adopted ? claimSlot(id, "like#route-like", ctx.existing, render) : render()
            );
          }
        }
      : undefined;
    const frame = createFrame(el, {
      id: address,
      host,
      adopt: adopted,
      slots,
      ownerScope: fn => runWithOwner(owner, fn)
    });
    // The key is needed only at attach. It must not become a permanent
    // authored-DOM difference, and frame routing does not read it again.
    el.removeAttribute("data-fid");
    if (binding)
      createRenderEffect(binding, address => {
        frame.rebind(address);
        el.removeAttribute("data-fid");
      });
    onCleanup(() => frame.dispose());
    return el;
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
