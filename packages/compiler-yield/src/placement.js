import { Analysis } from "./semantic.js";
const inside = (node, parent) => {
  for (let n = node; n; n = n.parent) if (n === parent) return true;
  return false;
};
const common = nodes => {
  for (let n = nodes[0]; n; n = n.parent) if (nodes.every(x => inside(x, n))) return n;
  return null;
};

export function analyzeInstances(
  modules,
  {
    resolve = (id, from) => new URL(id, `file://${from}`).pathname,
    entry,
    AnalysisClass = Analysis,
    inspect
  } = {}
) {
  const a = new AnalysisClass(modules, resolve);
  const templates = [],
    rootCalls = [];
  for (const r of a.modules.values())
    r.program.traverse({
      CallExpression(p) {
        const callee = p.get("callee");
        if (!callee.isIdentifier()) return;
        const b = callee.scope.getBinding(callee.node.name);
        if (!b?.path.isImportSpecifier() || b.path.parentPath.node.source.value !== "solid-yield")
          return;
        const name = b.path.node.imported.name;
        if (name === "component")
          templates.push({
            p,
            r,
            binding: p.parentPath.isVariableDeclarator()
              ? p.parentPath.scope.getBinding(p.parentPath.node.id.name)
              : null
          });
        if (
          ["render", "hydrate", "renderToString", "renderToStream"].includes(name) &&
          (!entry || r.id === entry)
        )
          rootCalls.push({ p, r });
      }
    });
  if (rootCalls.length) for (const { p, r } of rootCalls) a.expr(p, r.env, { host: "view" });
  else {
    let roots = templates.filter(
      t =>
        (!entry || t.r.id === entry) &&
        !t.binding?.referencePaths.some(p => p.findParent(q => q.isFunction()))
    );
    if (!roots.length && entry) {
      const r = a.modules.get(entry);
      const value =
        r?.exports.has("default") && a.exported(entry, "default", r.program.get("body")[0], r.env);
      if (value) a.materialize(value, value.path, r.env, { host: "view" });
    } else {
      if (!roots.length) roots = templates.slice(0, 1);
      for (const { p, r } of roots) a.materialize(a.expr(p, r.env), p, r.env, { host: "view" });
    }
  }
  // Jobs model callback hosts. They may discover further helper jobs.
  for (let i = 0; i < a.jobs.length; i++) {
    if (i > 5000) throw new Error("C1 callback expansion exceeded 5000 sites");
    a.jobs[i]();
  }
  for (const context of a.contexts) {
    for (const v of context.providers) context.deps.add(v);
    if (!context.providers.length) {
      const u = a.unknown(
        context.path,
        a.moduleOf.get(context.path.node).env,
        "foreign primitive",
        "Required context has no visible provider"
      );
      context.deps.add(u);
    }
  }
  for (const v of a.facts.values())
    if (v.contextField) {
      const { context, name } = v.contextField;
      for (const provider of context.providers)
        v.deps.add(a.prop(provider, name, v.path, { id: v.id, frame: v.owner }));
      if (!context.providers.length) v.deps.add(context);
    }
  // Imports used as data remain U even under arithmetic, a helper return or a
  // cell initializer. Callee-only imports are code and are not dependencies.
  const dataSeen = new Set();
  const imports = v => {
    if (!v || dataSeen.has(v)) return;
    dataSeen.add(v);
    const foreign = a.readForeign(v, { id: v.id, frame: v.owner });
    if (foreign !== v) v.deps.add(foreign);
    for (const dep of v.deps) imports(dep);
  };
  for (const p of a.parts) imports(p);
  let changed = true;
  while (changed) {
    changed = false;
    for (const v of a.facts.values()) {
      if (v.boundValue?.p === 2 && v.base !== 2) {
        v.base = 2;
        v.resolved = true;
        changed = true;
      }
      const p = Math.max(v.base, ...[...v.deps].map(x => x?.p ?? 1));
      const pending = v.pending || [...v.deps].some(x => x?.pending);
      const failing = v.failing || [...v.deps].some(x => x?.failing);
      if (v.p !== p || v.pending !== pending || v.failing !== failing) {
        v.p = p;
        v.pending = pending;
        v.failing = failing;
        changed = true;
      }
    }
  }
  const reach = (v, seen = new Set()) => {
    if (!v || seen.has(v)) return seen;
    seen.add(v);
    for (const d of v.deps) reach(d, seen);
    return seen;
  };
  const resources = (v, seen = new Set()) => {
    if (!v || seen.has(v) || v.rendered) return seen;
    seen.add(v);
    for (const d of v.deps) resources(d, seen);
    return seen;
  };
  const live = a.parts.filter(p => p.p > 0 && !p.structural);
  const parent = new Map(live.map(p => [p, p]));
  const root = p => {
    while (parent.get(p) !== p) p = parent.get(p);
    return p;
  };
  const merges = [],
    keys = new Set();
  const edge = (x, y, rule) => {
    if (x === y || !parent.has(x) || !parent.has(y)) return;
    const k = `${rule}:${[x.id, y.id].sort().join("|")}`;
    if (keys.has(k)) return;
    keys.add(k);
    merges.push({ rule, sites: [x.at, y.at], instances: [x.id, y.id] });
    const xr = root(x),
      yr = root(y);
    if (xr !== yr) parent.set(yr, xr);
  };
  const reads = new Map(live.map(p => [p, resources(p)]));
  for (const p of live)
    for (const v of reads.get(p))
      if (parent.has(v)) edge(p, v, ["event", "timer"].includes(p.kind) ? "M2" : "M1");
  for (const leak of a.leaks.values()) {
    const shared = [...leak.values].filter(v => !v.freshAllocation);
    const allocations = [...leak.values].filter(v => v.freshAllocation).map(v => [v]);
    for (const values of [shared, ...allocations]) {
      const users = live.filter(p => values.some(v => reads.get(p).has(v)));
      for (const p of users.slice(1)) edge(users[0], p, "M6");
    }
  }
  for (const c of a.contexts) {
    const parts = live.filter(p => p.context === c);
    for (const x of parts) for (const y of parts) edge(x, y, "M3");
  }
  const under = part => live.filter(p => inside(p.anchor, part.anchor));
  for (const p of a.parts) {
    if (p.kind === "flow" && p.p > 0) for (const x of under(p)) edge(p, x, "M5");
    if (p.kind === "boundary") {
      const children = under(p);
      if (children.some(x => x.pending || x.failing)) {
        if (!parent.has(p)) {
          parent.set(p, p);
          live.push(p);
          reads.set(p, resources(p));
        }
        for (const x of children) edge(p, x, "M4");
      }
    }
    // Foreign ancestry is a lifetime constraint, not a shared-state edge.
    // Keep independent child groups, but do not offer them as stable slots.
  }
  const groups = () => {
    const map = new Map();
    for (const p of live) {
      const r = root(p);
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(p);
    }
    return [...map.values()];
  };
  const span = ps => {
    const anchors = ps
      .filter(p =>
        ["hole", "bind", "foreign", "flow", "boundary", "capture-owner"].includes(p.kind)
      )
      .map(p => p.anchor)
      .filter(Boolean);
    if (!anchors.length) anchors.push(...ps.map(p => p.owner?.anchor).filter(Boolean));
    return common(anchors);
  };
  const captureFailures = [];
  for (const ps of groups()) {
    const owners = new Set(ps.map(p => p.owner));
    for (const p of ps)
      for (const value of reads.get(p) ?? []) {
        const binding = value.binding;
        if (!binding?.frame || owners.has(binding.frame) || value.part) continue;
        const closure = value.callable?.kind === "function" && !value.callable.path.node.generator;
        if (!value.nonserializable && !closure && value.p === 0) continue;
        const id = `${binding.frame.id}:capture:${binding.at}`;
        let owner = live.find(x => x.id === id);
        if (!owner) {
          owner = {
            id,
            at: binding.at,
            kind: "capture-owner",
            p: 2,
            deps: new Set([value]),
            owner: binding.frame,
            anchor: binding.frame.anchor
          };
          live.push(owner);
          parent.set(owner, owner);
          reads.set(owner, resources(owner));
          captureFailures.push({
            variable: binding.name,
            at: binding.at,
            reason: closure
              ? "setup-local function would cross the root edge"
              : value.nonserializable
                ? "setup-local instance has no proved serialization"
                : "setup-local non-source client value would cross the root edge"
          });
        }
        edge(p, owner, "CAPTURE_FALLBACK");
      }
  }
  // Equal spans cannot be claimed independently. Strict containment can be a slot.
  changed = true;
  while (changed) {
    changed = false;
    const gs = groups();
    for (let i = 0; i < gs.length; i++)
      for (const other of gs.slice(i + 1)) {
        const s = span(gs[i]);
        if (s && s === span(other) && root(gs[i][0]) !== root(other[0])) {
          edge(gs[i][0], other[0], "SPAN_OVERLAP");
          changed = true;
        }
      }
  }
  const gs = groups();
  const mayRecreate = n =>
    a.parts.some(p => ((p.kind === "flow" && p.p > 0) || p.foreignOwner) && inside(n, p.anchor));
  const roots = gs.map((ps, i) => {
    const s = span(ps),
      effects = ps.filter(p => p.kind === "effect");
    const mode =
      effects.length || ps.some(p => p.eager)
        ? "eager"
        : ps.some(p => p.p === 1 || [...(reads.get(p) ?? [])].some(v => v.base === 1))
          ? "visible"
          : "lazy";
    const slots = a.dom
      .filter(
        n =>
          s &&
          n !== s &&
          inside(n, s) &&
          n.value?.p === 0 &&
          !ps.some(p => inside(p.anchor, n)) &&
          !mayRecreate(n)
      )
      .filter(n => !n.parent || n.parent.value?.p !== 0);
    return {
      id: i + 1,
      span: s?.at ?? null,
      spanKind: s?.kind ?? null,
      size: ps.length,
      mode,
      sites: ps.map(p => p.at),
      parts: ps.map(p => ({
        at: p.at,
        kind: p.kind,
        expression: p.path?.toString() ?? "capture owner"
      })),
      instances: [...new Set(ps.map(p => p.owner?.id).filter(Boolean))],
      components: [...new Set(ps.map(p => p.owner?.name).filter(Boolean))],
      slots: [
        ...slots.map(n => ({
          at: n.at,
          kind: n.kind,
          reason: "S subtree, no root part, no client re-creation"
        })),
        ...gs.flatMap((other, j) => {
          const child = span(other);
          return i !== j && s && child && child !== s && inside(child, s) && !mayRecreate(child)
            ? [
                {
                  at: child.at,
                  kind: "client-root",
                  root: j + 1,
                  reason: "Independent child group; parent has no re-creation path"
                }
              ]
            : [];
        })
      ],
      effectReach: effects.map(e => ({
        at: e.at,
        touched: ps.filter(p => p !== e && reads.get(e).has(p)).map(p => p.at),
        pulledIn: ps.filter(p => !reads.get(e).has(p)).map(p => p.at)
      })),
      eagerSetupReach: ps
        .filter(p => p.eager)
        .map(e => ({
          at: e.at,
          expression: e.path?.toString(),
          touched: ps.filter(p => p !== e && reads.get(e).has(p)).map(p => p.at),
          pulledIn: ps.filter(p => !reads.get(e).has(p)).map(p => p.at)
        })),
      foreignAncestors: a.parts
        .filter(p => p.foreignOwner && s && s !== p.anchor && inside(s, p.anchor))
        .map(p => p.at),
      fallback: s ? null : "unresolved DOM owner"
    };
  });
  const holes = a.parts.filter(p => ["hole", "bind"].includes(p.kind));
  const elements = a.dom.filter(n => n.kind === "element");
  const used = new Set();
  for (const p of a.parts) for (const v of reach(p)) used.add(v);
  inspect?.(a, groups());
  return {
    definitions: {
      provenance: "S < U < C; join=max",
      units: "call-site instances; recursive rows are one widened family",
      markupBytes: "not measured",
      limitations: [
        "Recursive families are static representatives, not dynamic counts",
        "Foreign ancestry constrains lifetime and slot extraction, not dependency grouping",
        "No extraction or serializer execution"
      ]
    },
    modules: [...a.modules.keys()],
    holes: { inert: holes.filter(p => p.p === 0).length, total: holes.length },
    elements: { inert: elements.filter(n => n.value?.p === 0).length, total: elements.length },
    jsxElements: {
      inert: elements.filter(n => n.path.isJSXElement() && n.value?.p === 0).length,
      total: elements.filter(n => n.path.isJSXElement()).length
    },
    hElements: {
      inert: elements.filter(n => !n.path.isJSXElement() && n.value?.p === 0).length,
      total: elements.filter(n => !n.path.isJSXElement()).length
    },
    sources: a.parts
      .filter(p => ["cell", "memo"].includes(p.kind))
      .map(p => ({
        at: p.at,
        instance: p.owner?.id,
        kind: p.kind,
        provenance: ["S", "U", "C"][p.p],
        written: !!p.written
      })),
    components: a.frames.map(f => ({
      at: f.at,
      call: f.call,
      name: f.name,
      instance: f.id,
      recursive: f.recursive
    })),
    roots,
    merges,
    captureFailures,
    leaks: [...a.leaks.values()]
      .filter(l => [...l.values].some(v => used.has(v) && !v.resolved))
      .map(({ values, ...l }) => ({
        ...l,
        clientParts: live.filter(p => [...values].some(v => reads.get(p).has(v))).length
      })),
    findings: a.findings
  };
}
