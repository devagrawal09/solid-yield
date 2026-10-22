// @ts-check
import { scalarKey } from "./graph.mjs";
// Immutable return values can be copied out of a summary. Allocated services,
// sources, contexts and closures must keep their invocation identity instead.
export function copyReturn(value) {
  if (!value) return value;
  if (value.tag === "plain" && value.value !== null && typeof value.value === "object") return null;
  if (
    [
      "plain",
      "unknown",
      "worst",
      "dependencyUnknown",
      "optionalMissing",
      "platform",
      "platformInstance"
    ].includes(value.tag)
  )
    return { ...value };
  if (value.tag === "promise") {
    const result = copyReturn(value.result);
    return result ? { ...value, rejects: [...value.rejects], result } : null;
  }
  if (value.tag === "union" || value.tag === "array") {
    const field = value.tag === "union" ? "arms" : "elements";
    const values = value[field].map(copyReturn);
    return values.every(Boolean) ? { ...value, [field]: values } : null;
  }
  return null;
}
export function appendUnique(target, values) {
  if (target) for (const value of values ?? []) if (!target.includes(value)) target.push(value);
}
export class Summaries {
  constructor() {
    this.ids = new WeakMap();
    this.scalars = new Map();
    this.nextId = 0;
    this.functions = new WeakMap();
    this.hits = 0;
    this.misses = 0;
  }
  id(value) {
    if (!value || typeof value !== "object") return String(value);
    if (this.ids.has(value)) return this.ids.get(value);
    const scalar = scalarKey(value);
    if (scalar !== null) {
      if (!this.scalars.has(scalar)) this.scalars.set(scalar, ++this.nextId);
      const id = this.scalars.get(scalar);
      this.ids.set(value, id);
      return id;
    }
    if (!this.ids.has(value)) this.ids.set(value, ++this.nextId);
    return this.ids.get(value);
  }
  key(fn, args, c, epoch) {
    const cells = [];
    for (let env = fn.env; env; env = env.parent)
      for (const [name, cell] of env.cells) cells.push(name + ":" + this.id(cell.value));
    return JSON.stringify([
      epoch,
      cells,
      args.map(v => this.id(v)),
      this.id(fn.thisValue),
      !!fn.callbackProp,
      c.scope,
      c.owner,
      c.path,
      !!c.loading,
      !!c.errored,
      !!c.untracked,
      c.mode,
      !!c.capture,
      !!c.caught,
      !!c.asyncRejections,
      this.id(c.refNode),
      c.providers.map(p => [this.id(p.context), this.id(p.value)]),
      (c.related ?? []).map(n => this.id(n))
    ]);
  }
  get(fn, key) {
    const entry = this.functions.get(fn)?.get(key);
    if (entry) this.hits++;
    else this.misses++;
    return entry;
  }
  set(fn, key, entry) {
    let contexts = this.functions.get(fn);
    if (!contexts) this.functions.set(fn, (contexts = new Map()));
    // This limits cache space, not analysis coverage. Uncached calls are checked.
    if (contexts.size >= 32) contexts.delete(contexts.keys().next().value);
    contexts.set(key, entry);
  }
  capture(c) {
    return {
      ...c,
      sink: [],
      caught: c.caught ? [] : c.caught,
      asyncRejections: c.asyncRejections ? [] : c.asyncRejections,
      exported: c.exported ? [] : c.exported,
      capture: c.capture ? { reactive: false, pending: false, failures: [], related: [] } : null
    };
  }
  effects(c) {
    return {
      sink: c.sink,
      caught: c.caught,
      asyncRejections: c.asyncRejections,
      exported: c.exported,
      capture: c.capture
    };
  }
  replay(effects, c) {
    for (const field of ["sink", "caught", "asyncRejections", "exported"])
      appendUnique(c[field], effects[field]);
    if (c.capture && effects.capture) {
      c.capture.pending ||= effects.capture.pending;
      c.capture.reactive ||= effects.capture.reactive;
      appendUnique(c.capture.failures, effects.capture.failures);
      appendUnique(c.capture.related, effects.capture.related);
    }
  }
}
