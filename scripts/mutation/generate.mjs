import babel from "../../packages/vite-plugin-yield/node_modules/@babel/core/lib/index.js";
import { parseProgram } from "../../packages/vite-plugin-yield/src/transform.js";
import { catalog } from "./catalog.mjs";
const t = babel.types;
const line = (source, offset) => source.slice(0, offset).split("\n").length;
// Keep all original line boundaries: exact-line matching is never helped by compaction.
const padded = (source, edit) => {
  const old = source.slice(edit.start, edit.end);
  const extra = Math.max(0, old.split("\n").length - edit.text.split("\n").length);
  return edit.text + "\n".repeat(extra);
};
const printExpression = node =>
  babel
    .transformFromAstSync(t.file(t.program([t.expressionStatement(node)])), undefined, {
      configFile: false,
      babelrc: false,
      compact: true
    })
    .code.replace(/;$/, "");
const component = p =>
  p.isFunction() &&
  /^[A-Z]/.test(
    p.node.id?.name ?? (p.parentPath.isVariableDeclarator() ? p.parentPath.node.id.name : "")
  ) &&
  p.getFunctionParent() === null;
const text = (source, n) => source.slice(n.start, n.end);
export function generate(source, filename) {
  const program = parseProgram(source, filename);
  const out = [];
  const add = (operator, node, edits, reason) => {
    edits.sort((a, b) => b.start - a.start);
    let mutated = source;
    for (const edit of edits)
      mutated = mutated.slice(0, edit.start) + padded(source, edit) + mutated.slice(edit.end);
    if (mutated === source) return;
    // Reject malformed edits as generator defects, never as killed mutants.
    parseProgram(mutated, filename);
    // The mutated routine: the top-level declaration holding the edit. Edits
    // keep every line boundary, so its lines hold in the mutated source.
    const top = program.node.body.find(st => st.start <= node.start && node.start < st.end);
    out.push({
      operator,
      line: line(source, node.start),
      routine: top ? { start: line(source, top.start), end: line(source, top.end) } : null,
      offset: node.start,
      source: mutated,
      equivalent: reason ?? catalog[operator].equivalent ?? null
    });
  };
  const replace = (operator, node, value, reason) =>
    add(operator, node, [{ start: node.start, end: node.end, text: value }], reason);
  const imported = p => {
    if (!p.isIdentifier()) return null;
    const b = p.scope.getBinding(p.node.name);
    if (!b?.path.isImportSpecifier() || b.path.parent.source.value !== "solid-js") return null;
    return b.path.node.imported.name;
  };
  const eventHandler = fn => {
    if (fn.findParent(q => q.isJSXAttribute() && /^on[A-Z]/.test(q.node.name.name))) return true;
    const name =
      fn.node.id?.name ??
      (fn.parentPath.isVariableDeclarator() ? fn.parentPath.node.id.name : null);
    const binding = name ? fn.parentPath.scope.getBinding(name) : null;
    return (
      binding?.referencePaths.some(q =>
        q.findParent(a => a.isJSXAttribute() && /^on[A-Z]/.test(a.node.name.name))
      ) ?? false
    );
  };
  const signals = [];
  program.traverse({
    VariableDeclarator(p) {
      if (
        t.isArrayPattern(p.node.id) &&
        t.isCallExpression(p.node.init) &&
        imported(p.get("init.callee")) === "createSignal"
      ) {
        const [read, write] = p.node.id.elements;
        if (t.isIdentifier(read))
          signals.push({
            read: read.name,
            write: t.isIdentifier(write) ? write.name : null,
            binding: p.scope.getBinding(read.name)
          });
      }
    }
  });
  const visible = (p, s) => p.scope.getBinding(s.read) === s.binding;
  program.traverse({
    TryStatement(p) {
      const n = p.node;
      if (!n.handler) return;
      if (n.finalizer) replace("delete-catch", n.handler, "");
      else replace("delete-catch", n, text(source, n.block));
    },
    ThrowStatement(p) {
      const n = p.node;
      if (p.findParent(q => q.isCatchClause()) && t.isIdentifier(n.argument))
        replace("swallow-catch", n, ";");
      if (t.isNewExpression(n.argument)) {
        replace("throw-string", n.argument, '"mutant failure"');
        replace("throw-object", n.argument, '({message:"mutant failure"})');
      }
      const fn = p.getFunctionParent();
      if (fn?.node.body?.directives?.some(d => d.value.value === "use server"))
        replace("server-new-class", n.argument, "new (class MutantFailure extends Error {})()");
    },
    Directive(p) {
      if (p.node.value.value === "use server") replace("remove-use-server", p.node, "");
    },
    JSXElement(p) {
      const n = p.node,
        name = n.openingElement.name;
      if (!t.isJSXIdentifier(name) || !n.closingElement) return;
      const binding = p.scope.getBinding(name.name);
      const api = binding?.path.isImportSpecifier() ? binding.path.node.imported.name : null;
      let op = api === "Errored" ? "delete-errored" : api === "Loading" ? "delete-loading" : null;
      const init = binding?.path.isVariableDeclarator() ? binding.path.get("init") : null;
      if (init?.isCallExpression() && imported(init.get("callee")) === "createContext")
        op = "delete-provider";
      if (op)
        add(op, n.openingElement, [
          { start: n.openingElement.start, end: n.openingElement.end, text: "<>" },
          { start: n.closingElement.start, end: n.closingElement.end, text: "</>" }
        ]);
    },
    AwaitExpression(p) {
      replace("remove-await", p.node, text(source, p.node.argument));
      const fn = p.getFunctionParent();
      if (!fn?.node.async || !eventHandler(fn)) return;
      const statement = p.getStatementParent();
      if (statement && !statement.isReturnStatement() && t.isBlockStatement(statement.parent))
        add("async-reject", { start: statement.node.end }, [
          {
            start: statement.node.end,
            end: statement.node.end,
            text: ' throw new Error("mutant rejection");'
          }
        ]);
    },
    CallExpression(p) {
      const api = imported(p.get("callee")),
        n = p.node;
      if (api === "useContext" && n.arguments[0]) {
        const create = program.node.body
          .flatMap(s =>
            t.isImportDeclaration(s) && s.source.value === "solid-js" ? s.specifiers : []
          )
          .find(s => t.isImportSpecifier(s) && s.imported.name === "createContext");
        if (create)
          replace("never-provided-context", n.arguments[0], create.local.name + "<number>()");
      }
      if (api === "createEffect") {
        const args = n.arguments;
        if (args.length > 1)
          add("effect-arity", n, [{ start: args[0].end, end: args.at(-1).end, text: "" }]);
        else if (args[0]) replace("effect-arity", n, text(source, n.callee) + "()");
      }
      if (api === "createMemo") {
        replace(
          "non-core-cache",
          n.callee,
          "((fn: () => any) => { let cached: any; return () => cached ??= fn(); })"
        );
        const fn = p.get("arguments.0");
        if (fn?.isFunction())
          for (const s of signals.filter(s => s.write && visible(fn, s))) {
            const body = fn.node.body;
            if (t.isBlockStatement(body))
              add("memo-write", n, [
                { start: body.start + 1, end: body.start + 1, text: ` ${s.write}(0);` }
              ]);
            else {
              const clone = t.cloneNode(fn.node, true);
              clone.body = t.blockStatement([
                t.expressionStatement(
                  t.callExpression(t.identifier(s.write), [t.numericLiteral(0)])
                ),
                t.returnStatement(t.cloneNode(body, true))
              ]);
              replace("memo-write", fn.node, printExpression(clone));
            }
          }
      }
      // Each known source read is its own site, including aliases resolved by Babel bindings.
      const callee = p.get("callee");
      if (callee.isIdentifier() && n.arguments.length === 0) {
        const b = p.scope.getBinding(callee.node.name);
        const d = b?.path;
        const signal = signals.find(s => s.binding === b);
        const memo =
          d?.isVariableDeclarator() &&
          d.get("init").isCallExpression() &&
          imported(d.get("init.callee")) === "createMemo";
        if (signal || memo) {
          const host = p.findParent(
            q =>
              q.isJSXExpressionContainer() ||
              (q.isCallExpression() && imported(q.get("callee")) === "createMemo")
          );
          const owner = p.findParent(component);
          if (host && owner && t.isBlockStatement(owner.node.body)) {
            const name = "__mutantSnapshot" + n.start;
            add("setup-read", owner.node.body, [
              { start: owner.node.body.end - 1, end: owner.node.body.end - 1, text: "" },
              { start: n.start, end: n.end, text: name },
              {
                start:
                  owner.node.body.body.find(s => t.isReturnStatement(s))?.start ??
                  owner.node.body.end - 1,
                end:
                  owner.node.body.body.find(s => t.isReturnStatement(s))?.start ??
                  owner.node.body.end - 1,
                text: `const ${name} = ${text(source, n)}; `
              }
            ]);
            // The authored mutation line is the inserted setup read, not the old JSX hole.
            out.at(-1).line = line(
              source,
              owner.node.body.body.find(s => t.isReturnStatement(s))?.start ??
                owner.node.body.end - 1
            );
          }
        }
      }
      const scheduler =
        (callee.isIdentifier() &&
          ["setTimeout", "setInterval", "requestAnimationFrame"].includes(callee.node.name)) ||
        (callee.isMemberExpression() &&
          t.isIdentifier(callee.node.property, { name: "addEventListener" }));
      if (scheduler && p.findParent(component) && !p.getFunctionParent()?.getFunctionParent()) {
        const index = callee.isMemberExpression() ? 1 : 0;
        let fn = p.get(`arguments.${index}`);
        if (fn?.isIdentifier()) {
          const b = fn.scope.getBinding(fn.node.name)?.path;
          fn = b?.isVariableDeclarator() ? b.get("init") : b;
        }
        if (fn?.isFunction())
          for (const s of signals.filter(s => visible(fn, s))) {
            const body = fn.node.body;
            if (t.isBlockStatement(body))
              add("timer-read", n, [
                { start: body.start + 1, end: body.start + 1, text: ` ${s.read}();` }
              ]);
            else {
              const clone = t.cloneNode(fn.node, true);
              clone.body = t.blockStatement([
                t.expressionStatement(t.callExpression(t.identifier(s.read), [])),
                t.returnStatement(t.cloneNode(body, true))
              ]);
              replace("timer-read", fn.node, printExpression(clone));
            }
          }
      }
    },
    Function(p) {
      if (!component(p)) return;
      const param = p.node.params[0];
      if (t.isIdentifier(param)) {
        const fields = new Map();
        p.traverse({
          MemberExpression(q) {
            if (
              t.isIdentifier(q.node.object, { name: param.name }) &&
              !q.node.computed &&
              t.isIdentifier(q.node.property)
            ) {
              const key = q.node.property.name;
              if (!fields.has(key)) fields.set(key, []);
              fields.get(key).push(q.node);
            }
          }
        });
        for (const [key, refs] of fields) {
          const suffix = param.typeAnnotation ? text(source, param.typeAnnotation) : "";
          const name = "__mutantProp" + param.start;
          add("destructure-props", param, [
            {
              start: param.start,
              end: param.end,
              text: `{ ${key}: ${name}, ...${param.name} }${suffix}`
            },
            ...refs.map(r => ({ start: r.start, end: r.end, text: name }))
          ]);
        }
      }
      // One inline copy at every JSX use, retaining other callers and exports.
      const name =
        p.node.id?.name ?? (p.parentPath.isVariableDeclarator() ? p.parentPath.node.id.name : null);
      if (!name) return;
      const uses = [];
      program.traverse({
        JSXElement(q) {
          if (t.isJSXIdentifier(q.node.openingElement.name, { name })) {
            const owner = q.findParent(component);
            if (owner && owner !== p && t.isBlockStatement(owner.node.body))
              uses.push({ q, owner });
          }
        }
      });
      for (const { q, owner } of uses) {
        const local = "MutantInline" + q.node.start;
        const clone = t.cloneNode(p.node, true);
        let declaration;
        if (t.isFunctionDeclaration(clone)) {
          clone.id = t.identifier(local);
          declaration = clone;
        } else
          declaration = t.variableDeclaration("const", [
            t.variableDeclarator(t.identifier(local), clone)
          ]);
        const singleLine = node => {
          if (t.isJSXText(node)) node.value = node.value.replace(/\s*\n\s*/g, " ");
          if (t.isTemplateElement(node)) node.value.raw = node.value.raw.replace(/\n/g, "\\n");
          for (const key of t.VISITOR_KEYS[node.type] ?? [])
            for (const child of Array.isArray(node[key]) ? node[key] : [node[key]])
              if (child) singleLine(child);
        };
        singleLine(declaration);
        const printed = babel.transformFromAstSync(t.file(t.program([declaration])), undefined, {
          configFile: false,
          babelrc: false,
          compact: true
        }).code;
        const edits = [
          { start: owner.node.body.start + 1, end: owner.node.body.start + 1, text: printed },
          {
            start: q.node.openingElement.name.start,
            end: q.node.openingElement.name.end,
            text: local
          }
        ];
        if (q.node.closingElement)
          edits.push({
            start: q.node.closingElement.name.start,
            end: q.node.closingElement.name.end,
            text: local
          });
        add("inline-component", owner.node.body, edits);
      }
    }
  });
  return out;
}
