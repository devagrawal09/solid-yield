// The only rc.13-specific runtime boundary. See documentation/compiler-adapter.md.
import { createOwner, runWithOwner, isHydrating } from "solid-js";
import { sharedConfig } from "solid-js/internal";
import { takeHydrationValue } from "@solidjs/web";
import installedVersions from "virtual:compiler-yield-solid-versions";

export function assertSolidVersions(versions) {
  for (const scope of ["adapter", "application"]) {
    const packages = versions?.[scope];
    if (packages?.["solid-js"] !== "2.0.0-rc.13" || packages?.["@solidjs/web"] !== "2.0.0-rc.13")
      throw new Error(
        `compiler-yield's frame adapter was validated against 2.0.0-rc.13; found solid-js ${packages?.["solid-js"] ?? "unknown"} / @solidjs/web ${packages?.["@solidjs/web"] ?? "unknown"} (${scope}) — see documentation/compiler-adapter.md`
      );
  }
}
// The plugin reads installed manifests for both the app and this adapter.
// This call stays in server and browser output, before any attachment happens.
assertSolidVersions(installedVersions);

const documentSlotKey = "like#route-like";

export function documentHosts() {
  return new Map(
    [...document.querySelectorAll("main[data-fid],section.reading-guide[data-fid]")].map(el => [
      el.getAttribute("data-fid"),
      el
    ])
  );
}

export function clearHostMarker(el) {
  el.removeAttribute("data-fid");
}

export function claimSlot(id, existing, render) {
  if (!isHydrating() || !existing.length) return render();
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
    return runWithOwner(createOwner({ id: `sc-${id}-${documentSlotKey}-` }), render);
  } finally {
    sharedConfig.registry = previous;
    sharedConfig.claimRoots = roots;
  }
}

export function seedDocumentSlot(host, id, address) {
  const key = documentSlotKey;
  const record = takeHydrationValue(`sc:slot:${id}:${key}`);
  if (!record || record.status !== "resolved")
    throw new Error(
      "R document slots require completed primitive inputs; see documentation/compiler-adapter.md"
    );
  host.apply({ type: "slot", id: address, version: 0, key, args: record.value });
}

export function installDocumentBinding(impl) {
  const registry = globalThis._$SC;
  if (!registry || typeof registry.r !== "function" || !registry.a)
    throw new Error(
      "R document server-component registry changed; see documentation/compiler-adapter.md"
    );
  registry.impl = impl;
  return {
    resolve: id => registry.r(id),
    connect(handler) {
      for (const [address, id] of Object.entries(registry.a)) handler.showing(address, id);
      registry.reg = (address, id) => handler.showing(address, id);
    }
  };
}

export function encodeHostedRegion(value, context, encode) {
  if (typeof value !== "function") return value;
  const root = value.regionRoot;
  if (root !== "main" && root !== "section") throw new Error("Unknown R host root");
  const encoded = encode(value, context);
  return Object.assign(props => {
    const nodes = encoded(props);
    if (
      !Array.isArray(nodes) ||
      nodes.length !== 3 ||
      !/^<solid-frame data-fid="[^"]+" style="display:contents">$/.test(nodes[0]?.t) ||
      nodes[2]?.t !== "</solid-frame>"
    )
      throw new Error("R document encoder shape changed; see documentation/compiler-adapter.md");
    return [
      {
        t: nodes[0].t
          .replace("<solid-frame", `<${root}`)
          .replace(' style="display:contents"', root === "section" ? ' class="reading-guide"' : "")
      },
      nodes[1],
      { t: `</${root}>` }
    ];
  }, encoded);
}
