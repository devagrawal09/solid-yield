// C1b only. Directional facts must not change the C1 placement equations.
import { Analysis } from "./semantic.js";
import { analyzeInstances } from "./placement.js";

const add = (v, key, x) => x && (v[key] ??= new Set()).add(x);
const sourceKinds = new Set(["cell", "memo"]);
const bodyKinds = new Set([
  "hole",
  "memo",
  "effect",
  "event",
  "cell",
  "timer",
  "flow",
  "boundary",
  "bind"
]);

export function sourcesOf(values) {
  const found = new Set(),
    seen = new Set();
  const walk = v => {
    if (!v || seen.has(v)) return;
    seen.add(v);
    if (sourceKinds.has(v.kind)) {
      found.add(v);
      return;
    }
    if (["event", "setter", "write", "refresh", "timer"].includes(v.kind)) return;
    if (v.rendered) return;
    for (const d of v.deps) walk(d);
  };
  for (const v of values) walk(v);
  return found;
}

export class ReachAnalysis extends Analysis {
  alternatives(v, seen = new Set()) {
    if (!v || seen.has(v)) return [];
    seen.add(v);
    if (v.callable) return [v];
    if (v.receiver && v.method) {
      const objects = this.objects(v.receiver);
      const fields = objects.flatMap(o =>
        v.method === "*" ? [...o.fields.values()] : [o.fields.get(v.method)]
      );
      const choices = fields.flatMap(x => this.alternatives(x, seen));
      return choices;
    }
    if (v.contextField) {
      const { context, name } = v.contextField;
      return context.providers.flatMap(o => this.alternatives(o.fields.get(name), seen));
    }
    const deps = [...v.deps];
    if (v.kind === "result" || /^(input-field|prop-input):/.test(v.kind))
      return this.alternatives(deps[0], seen);
    if (v.kind === "computed-field" || v.kind === "return")
      return deps.flatMap(x => this.alternatives(x, seen));
    return [];
  }
  objects(v, seen = new Set()) {
    if (!v || seen.has(v)) return [];
    seen.add(v);
    if (v.context) return v.context.providers.flatMap(o => this.objects(o, seen));
    if (v.contextField)
      return v.contextField.context.providers.flatMap(o =>
        this.objects(o.fields.get(v.contextField.name), seen)
      );
    if (v.fields.size) return [v];
    return [...v.deps].flatMap(x => this.objects(x, seen));
  }
  invoke(fn, args, p, env, ctx = {}, role = "call") {
    // The original pass queues creator bodies. Tag the body being visited,
    // including generator initializers of optimistic stores.
    const kind = {
      memo: "memo",
      initial: "cell",
      "event-body": "event",
      compute: "effect",
      "effect-body": "effect"
    }[role];
    const own = kind && this.facts.get(`${env.id}:${p.node.start}:${kind}`);
    const part = own || ctx.reachPart || ctx.event;
    if (part && fn?.callable?.path) add(part, "bodies", fn.callable.path);
    const reads = own ? new Set() : ctx.reads;
    const result = super.invoke(
      fn,
      args,
      p,
      env,
      { ...ctx, reads, reachPart: part },
      `${role}:fn${fn?.callable?.path?.node.start ?? "external"}`
    );
    if (own) for (const v of reads) add(own, "readValues", v);
    return result;
  }
  call(fn, args, p, env, ctx = {}, construct = false) {
    if (fn?.kind === "reset") {
      const part = ctx.reachPart || ctx.event;
      if (part)
        part.resetBoundary = this.parts.find(
          b => b.kind === "boundary" && b.path.node === fn.path.node && b.owner === fn.owner
        )?.anchor;
    }
    if (fn && !fn.callable && !fn.external && !fn.global) {
      const choices = this.alternatives(fn);
      if (choices.length)
        return this.join(
          p,
          env,
          choices.map(v => this.call(v, args, p, env, ctx)),
          "resolved-call"
        );
    }
    const part = ctx.reachPart || ctx.event;
    const name = fn?.external?.source === "solid-yield" && fn.external.name;
    if (part && fn?.callable?.kind === "setter") {
      add(part, "writes", fn.callable.cell);
      // An updater reads the previous store/signal even without yield*.
      for (const arg of args)
        if (arg.callable) {
          add(part, "readValues", fn.callable.cell);
          this.invoke(arg, [fn.callable.cell], p, env, ctx, "write-updater");
        }
    }
    if (part && name === "refresh") for (const v of args) add(part, "writes", v);
    if (part && fn?.callable?.kind === "event") add(part, "calls", fn.callable.event);
    // C1 ignores attempt's failure callback for provenance. C1b must include
    // its writes, including errors that are absorbed after optimistic writes.
    if (["attempt", "until"].includes(name) && args[1]?.callable)
      this.invoke(
        args[1],
        [this.value(p, env, "failure-argument", 2)],
        p,
        env,
        ctx,
        "failure-callback"
      );
    // A computed action lookup (todos retry) can choose any known member.
    if (fn?.method === "*" && fn.receiver?.fields.size) {
      const choices = [...fn.receiver.fields.values()].filter(v => v.callable);
      if (choices.length)
        return this.join(
          p,
          env,
          choices.map(v => this.call(v, args, p, env, ctx)),
          "call-alternatives"
        );
    }
    const result = super.call(fn, args, p, env, ctx, construct);
    return result;
  }
  hole(p, v, env, ctx, bind = false) {
    if (bind && v.kind === "reset") {
      const handler = this.part(p, env, "event", [], ctx);
      handler.base = 2;
      handler.binding = { name: "reset", at: this.at(p), frame: env.frame };
      handler.nativeRuntime = true;
      handler.resetBoundary = this.parts.find(
        b => b.kind === "boundary" && b.path.node === v.path.node && b.owner === v.owner
      )?.anchor;
      const out = this.part(p, env, "bind", [handler], ctx);
      out.base = 2;
      return out;
    }
    if (bind && v.callable?.kind === "function") {
      const handler = this.part(p, env, "event", [], ctx);
      handler.base = 2;
      handler.inline = true;
      this.jobs.push(() => {
        const reads = new Set();
        this.invoke(
          v,
          [this.value(p, env, "dom-event", 2)],
          p,
          env,
          { ...ctx, host: "event", event: handler, reachPart: handler, reads },
          "bound-handler"
        );
        handler.readValues = reads;
      });
      const out = this.part(p, env, "bind", [handler], ctx);
      out.base = 2;
      return out;
    }
    return super.hole(p, v, env, ctx, bind);
  }
}

const inside = (anchor, parent) => {
  for (let x = anchor; x; x = x.parent) if (x === parent) return true;
  return false;
};
export function graphOf(a) {
  const parts = a.parts.filter(p => bodyKinds.has(p.kind) && !p.structural);
  const reads = new Map(parts.map(p => [p, sourcesOf(p.readValues ?? p.deps)]));
  const fallback = p =>
    !!p.path?.findParent(
      q => q.isObjectProperty() && (q.node.key.name ?? q.node.key.value) === "fallback"
    );
  // Bind to event references, without mistaking event reads for calls.
  const referencedEvents = values => {
    const out = new Set(),
      seen = new Set();
    const visit = v => {
      if (!v || seen.has(v)) return;
      seen.add(v);
      if (v.kind === "event") {
        out.add(v);
        return;
      }
      if (sourceKinds.has(v.kind) || v.rendered) return;
      for (const d of v.deps) visit(d);
    };
    for (const v of values) visit(v);
    return out;
  };
  const bound = new Set(
    parts.filter(p => p.kind === "bind").flatMap(p => [...referencedEvents(p.deps)])
  );
  function reach(seeds, changed = []) {
    const reached = new Set(seeds),
      writes = new Set(changed),
      needed = new Set();
    let dirty = true;
    while (dirty) {
      dirty = false;
      const put = (set, v) => {
        if (!set.has(v)) {
          set.add(v);
          dirty = true;
        }
      };
      for (const p of reached) {
        for (const w of p.writes ?? []) put(writes, w);
        for (const c of p.calls ?? []) put(reached, c);
        for (const r of reads.get(p) ?? []) put(needed, r);
        if (p.resetBoundary)
          for (const q of parts)
            if (!["event", "bind", "timer"].includes(q.kind) && inside(q.anchor, p.resetBoundary)) {
              put(reached, q);
              for (const r of reads.get(q) ?? []) put(writes, r);
            }
        // Changing a flow recreates its descendants. Include all alternatives.
        if (p.kind === "flow")
          for (const q of parts)
            if (!["event", "bind", "timer"].includes(q.kind) && inside(q.anchor, p.anchor))
              put(reached, q);
        if (["hole", "flow"].includes(p.kind) && (p.pending || p.failing)) {
          for (const b of parts.filter(q => q.kind === "boundary" && inside(p.anchor, q.anchor))) {
            put(reached, b);
            for (const q of parts)
              if (
                fallback(q) &&
                !["event", "bind", "timer"].includes(q.kind) &&
                inside(q.anchor, b.anchor)
              )
                put(reached, q);
          }
        }
      }
      for (const w of writes) put(reached, w);
      // Pending sources read by the event must exist even if it never writes
      // them. Follow their upstream reads, not all of their other consumers.
      for (const r of needed) {
        put(reached, r);
        for (const upstream of reads.get(r) ?? []) put(needed, upstream);
      }
      for (const p of parts) {
        if (["event", "bind", "timer"].includes(p.kind)) continue;
        if ([...reads.get(p)].some(r => writes.has(r))) {
          put(reached, p);
          if (sourceKinds.has(p.kind)) put(writes, p);
        }
      }
    }
    return { parts: reached, writes, reads: needed };
  }
  return { a, parts, reads, bound, reach, events: parts.filter(p => p.kind === "event") };
}
export function analyzeReachability(modules, options = {}) {
  let graph;
  const placement = analyzeInstances(modules, {
    ...options,
    AnalysisClass: ReachAnalysis,
    inspect: (a, groups) => {
      graph = graphOf(a);
      graph.groups = groups;
    }
  });
  return { graph, placement };
}
export function partName(p) {
  const name =
    p.binding?.name || p.path?.parentPath?.node?.key?.name || p.path?.parentPath?.node?.id?.name;
  return `${p.owner?.name ?? "module"}.${name ?? p.kind}@${p.at.split(":").slice(-2).join(":")}`;
}
export function authoredRanges(part, a) {
  const paths = [...(part.bodies ?? [])];
  if (part.kind === "hole") {
    let path = part.path;
    // The inherited flow hole points at its source's definition. Charge the
    // actual each/when expression, not that source's entire creator again.
    if (part.anchor?.kind === "flow" && part.anchor.path.isCallExpression()) {
      const input = part.anchor.path.get("arguments")[0];
      if (input?.isObjectExpression()) {
        const field = input
          .get("properties")
          .find(
            p => p.isObjectProperty() && ["each", "when", "count", "on"].includes(p.node.key.name)
          );
        if (
          field &&
          !(
            path.node.start >= part.anchor.path.node.start &&
            path.node.end <= part.anchor.path.node.end
          )
        )
          path = field.get("value");
      }
    }
    if (path.isJSXExpressionContainer()) path = path.get("expression");
    paths.push(path);
  }
  // Flow/boundary creation is descriptor work; their child bodies are
  // separate parts. Cell scalar initialization is serialized data.
  return paths.map(p => ({
    file: a.moduleOf.get(p.node).id,
    start: p.node.start,
    end: p.node.end
  }));
}
