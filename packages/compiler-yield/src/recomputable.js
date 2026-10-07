import { Analysis } from "./semantic.js";
import { analyzeInstances } from "./placement.js";

// Keep the C1 graph and its dependency groups intact. R is a second placement
// calculation: a server call cuts data provenance, never ownership or writes.
class RecomputableAnalysis extends Analysis {
  call(fn, args, p, env, ctx = {}, construct = false) {
    const out = super.call(fn, args, p, env, ctx, construct);
    if (out.kind === "server-call" && ctx.host === "memo") {
      out.serverArgs = args;
      out.serverTarget = p.get("callee").toString();
      out.serverParams = fn.callable.path.node.params;
    }
    return out;
  }
  control(name, props, p, env, ctx) {
    const out = super.control(name, props, p, env, ctx);
    if (name === "Errored") {
      const error = this.facts.get(`${env.id}:${p.node.start}:boundary-error`);
      // An error accessor stays inside its boundary. It is not a C cell. A
      // reset bind is still C, and a client child makes the whole boundary client.
      if (error) error.serverBoundary = out;
    }
    return out;
  }
}
const closure = (value, seen = new Set()) => {
  if (!value || seen.has(value)) return seen;
  seen.add(value);
  for (const dep of value.deps) closure(dep, seen);
  return seen;
};
const inside = (node, parent) => {
  for (let n = node; n; n = n.parent) if (n === parent) return true;
  return false;
};
const scalarType = node => {
  if (!node) return false;
  if (
    [
      "TSStringKeyword",
      "TSNumberKeyword",
      "TSBooleanKeyword",
      "TSUndefinedKeyword",
      "TSNullKeyword",
      "TSLiteralType"
    ].includes(node.type)
  )
    return true;
  return node.type === "TSUnionType" && node.types.every(scalarType);
};
const serializable = (v, param) => {
  const values = closure(v);
  if ([...values].some(x => x.nonserializable || x.callable?.kind === "function" || x.class))
    return false;
  // A typed scalar call edge in a well-typed program is eligible. The emitter
  // must still apply the public capture codec to the actual settled input.
  if (scalarType(param?.typeAnnotation?.typeAnnotation)) return true;
  if (v.known)
    return v.literal == null || ["string", "number", "boolean"].includes(typeof v.literal);
  if (["array", "object"].includes(v.kind))
    return [...v.fields.values()].every(x => serializable(x));
  return v.p === 0 && ![...values].some(x => x.base > 0 || x.mutable || x.global || x.external);
};

export function analyzeRecomputable(modules, options = {}) {
  let result;
  const before = analyzeInstances(modules, {
    ...options,
    AnalysisClass: RecomputableAnalysis,
    inspect(a) {
      const facts = [...a.facts.values()];
      const calls = facts.filter(v => v.serverArgs);
      const rejected = [];
      for (const call of calls) {
        call.captureEligible = call.serverArgs.every((v, i) =>
          serializable(v, call.serverParams[i])
        );
        if (!call.captureEligible)
          rejected.push({
            at: call.at,
            reason: "Server argument has no proved serializable shape",
            expression: call.path.toString()
          });
      }
      // S=0, R=1, U=2, C=3. Error accessors get their boundary's server
      // provenance rather than the old blanket C label; reset stays C.
      for (const v of facts) v.r = v.serverBoundary ? 0 : v.base === 2 ? 3 : v.base === 1 ? 2 : 0;
      const memos = facts.filter(v => v.kind === "memo");
      for (const memo of memos) {
        const reachable = closure(memo);
        memo.serverCalls = calls.filter(call => reachable.has(call));
        memo.argumentReads = new Set(
          memo.serverCalls.flatMap(call => call.serverArgs.flatMap(arg => [...closure(arg)]))
        );
      }
      let changed = true;
      while (changed) {
        changed = false;
        for (const v of facts) {
          let next;
          if (v.serverBoundary) {
            const seen = new Set();
            const boundaryRead = x => {
              if (seen.has(x) || x.serverBoundary) return 0;
              seen.add(x);
              if (x.serverArgs || x.kind === "memo") return x.r;
              return Math.max(
                x.base === 2 ? 3 : x.base === 1 ? 2 : 0,
                ...[...x.deps].map(boundaryRead)
              );
            };
            next = boundaryRead(v.serverBoundary);
          } else if (v.serverArgs && v.captureEligible) {
            const inputs = v.serverArgs.map(x => x.r);
            next = inputs.includes(3) ? 3 : inputs.some(x => x > 0) ? 1 : 0;
          } else if (v.serverArgs) {
            next = Math.max(2, ...v.serverArgs.map(x => x.r));
          } else {
            let deps = [...v.deps];
            if (v.kind === "memo" && v.serverCalls.length) {
              // Reads feeding the call key become arguments. Unrelated reads
              // still participate; in particular no C read is ever cut.
              deps = deps.filter(x => !(v.argumentReads.has(x) && x.r === 2));
            }
            next = Math.max(v.base === 2 ? 3 : v.base === 1 ? 2 : 0, ...deps.map(x => x.r));
          }
          if (next !== v.r) {
            v.r = next;
            changed = true;
          }
        }
      }
      const count = values => ({
        S: values.filter(v => v.r === 0).length,
        R: values.filter(v => v.r === 1).length,
        client: values.filter(v => v.r > 1).length,
        total: values.length
      });
      const argumentsFor = region => {
        const relevant = calls.filter(call => inside(call.owner?.anchor, region));
        const vector = relevant.flatMap(call =>
          call.serverArgs
            .filter(arg => arg.r > 0)
            .map(arg => {
              const dependencies = closure(arg);
              const props = facts.find(v => v.kind === "props" && v.owner === region.frame);
              const fields = [...(props?.fields ?? [])].filter(
                ([, value]) => dependencies.has(value) && value.r > 0
              );
              const supplied = region.path.isCallExpression() && region.path.get("arguments")[0];
              const property =
                supplied?.isObjectExpression() &&
                supplied
                  .get("properties")
                  .find(
                    p =>
                      p.isObjectProperty() &&
                      fields.some(([name]) => name === (p.node.key.name ?? p.node.key.value))
                  );
              return {
                expression: property ? property.get("value").toString() : arg.path?.toString(),
                at: property ? a.at(property) : arg.at,
                call: call.serverTarget,
                capture: call.captureEligible
                  ? "typed scalar; runtime codec check required"
                  : "rejected"
              };
            })
        );
        return [...new Map(vector.map(x => [x.at + x.expression, x])).values()];
      };
      const components = a.frames.map(frame => {
        const output = facts.find(v => v.kind === "component-output" && v.owner === frame);
        const ownParts = a.parts.filter(p => p.owner === frame && !p.structural);
        const clientOwn = ownParts.some(p => p.r > 1 && !["boundary"].includes(p.kind));
        const descendants = a.frames.filter(child => child.parent === frame);
        return { frame, output, clientOwn, descendants };
      });
      const regions = components
        .filter(
          c =>
            !c.clientOwn &&
            c.output &&
            c.output.r <= 1 &&
            calls.some(call => inside(call.owner?.anchor, c.frame.anchor))
        )
        .filter(
          c =>
            !components.some(
              parent =>
                parent !== c &&
                parent.output?.r <= 1 &&
                !parent.clientOwn &&
                inside(c.frame.anchor.parent, parent.frame.anchor)
            )
        )
        .map(c => ({
          component: c.frame.name,
          at: c.frame.call,
          provenance: c.output.r === 0 ? "S" : "R",
          arguments: argumentsFor(c.frame.anchor),
          slots: [],
          instance: c.frame.id
        }));
      result = {
        holes: count(a.parts.filter(p => ["hole", "bind"].includes(p.kind))),
        jsx: count(
          a.dom.filter(n => n.kind === "element" && n.path.isJSXElement()).map(n => n.value)
        ),
        h: count(
          a.dom.filter(n => n.kind === "element" && !n.path.isJSXElement()).map(n => n.value)
        ),
        regions,
        captures: rejected,
        serverCalls: calls.map(call => ({
          at: call.at,
          instance: call.owner?.id,
          target: call.serverTarget,
          provenance: ["S", "R", "U", "C"][call.r],
          captureEligible: call.captureEligible
        })),
        sources: memos.map(v => ({
          at: v.at,
          component: v.owner?.name,
          provenance: ["S", "R", "U", "C"][v.r]
        }))
      };
      options.inspect?.(a);
    }
  });
  return {
    ...result,
    before: { holes: before.holes, jsx: before.jsxElements, h: before.hElements },
    clientGroups: before.roots.map(({ id, components, mode, size }) => ({
      id,
      components,
      mode,
      size
    }))
  };
}
