import { printMapped } from "./positions.js";
// @ts-check
import babel from "@babel/core";
import { parseProgram } from "./transform.js";
const t = babel.types;
/** @typedef {import('@babel/core').NodePath<any>} Path */
/** @param {Path} p */
const api = p => {
  const b = p.isIdentifier() ? p.scope.getBinding(p.node.name)?.path : null;
  return b?.isImportSpecifier() && b.parentPath.isImportDeclaration()
    ? {
        module: b.parentPath.node.source.value,
        name: t.isIdentifier(b.node.imported) ? b.node.imported.name : b.node.imported.value
      }
    : null;
};
/** Normalize native control contracts before routine reconstruction.
 * @param {Map<string,string>} files */
export function nativePrelude(files) {
  const out = new Map();
  for (const [file, code] of files) {
    const p = parseProgram(code, file);
    if (!p) continue;
    const used = new Set();
    p.traverse({
      VariableDeclarator(q) {
        const init = q.get("init");
        if (!t.isIdentifier(q.node.id) || !init.isObjectExpression()) return;
        const action = init
          .get("properties")
          .find(
            prop =>
              prop.isObjectProperty() &&
              prop.get("value").isCallExpression() &&
              api(prop.get("value.callee"))?.module === "solid-js" &&
              api(prop.get("value.callee"))?.name === "action"
          );
        if (!action) return;
        if (!t.isObjectProperty(action.node) || !t.isCallExpression(action.node.value)) return;
        const actionCallee = action.node.value.callee,
          bagName = q.node.id.name;
        if (!t.isExpression(actionCallee)) return;
        const methods = init.get("properties").filter(prop => prop.isObjectMethod());
        const forwarders = [];
        for (const method of methods) {
          let forwards = false;
          method.traverse({
            CallExpression(site) {
              const callee = site.get("callee");
              if (!callee.isTSAsExpression() || !t.isTSAnyKeyword(callee.node.typeAnnotation))
                return;
              const target = callee.get("expression");
              if (
                !target.isMemberExpression() ||
                !t.isIdentifier(target.node.object, { name: bagName })
              )
                return;
              forwards = true;
              used.add("nativeDispatch");
              site.replaceWith(
                t.callExpression(t.identifier("__nativeDispatch"), [
                  target.node,
                  t.arrayExpression(
                    site.node.arguments.map(arg => {
                      if (!t.isExpression(arg) && !t.isSpreadElement(arg))
                        throw new Error(`[NATIVE_ACTION] Unsupported action argument. (${file})`);
                      return arg;
                    })
                  )
                ])
              );
            }
          });
          if (!forwards) continue;
          method.traverse({
            ReturnStatement(ret) {
              const value = ret.get("argument");
              if (
                value.isCallExpression() &&
                t.isMemberExpression(value.node.callee) &&
                t.isIdentifier(value.node.callee.object, { name: "Promise" }) &&
                t.isIdentifier(value.node.callee.property, { name: "resolve" }) &&
                !value.node.arguments.length
              )
                ret.node.argument = null;
            }
          });
          const id = q.scope.generateUidIdentifier(
            t.isIdentifier(method.node.key) ? method.node.key.name : "forward"
          );
          const fn = t.functionExpression(null, method.node.params, method.node.body, true);
          forwarders.push({
            key: method.node.key,
            id,
            declaration: t.variableDeclaration("const", [
              t.variableDeclarator(id, t.callExpression(t.cloneNode(actionCallee), [fn]))
            ])
          });
          method.remove();
        }
        if (!forwarders.length) return;
        const binding = q.scope.getBinding(q.node.id.name);
        // The original object methods close over the action bag. Keep that
        // bag acyclic, then expose its forwarding events in the returned bag.
        for (const ref of binding?.referencePaths ?? []) {
          if (
            !ref.isIdentifier() ||
            ref.findParent(site => site.isTSType()) ||
            ref.parentPath?.isMemberExpression()
          )
            continue;
          ref.replaceWith(
            t.objectExpression([
              t.spreadElement(ref.node),
              ...forwarders.map(({ key, id }) => t.objectProperty(key, id))
            ])
          );
        }
        q.parentPath.insertAfter(forwarders.map(f => f.declaration));
      }
    });
    p.traverse({
      VariableDeclarator(q) {
        const init = q.get("init");
        if (
          !init.isCallExpression() ||
          api(init.get("callee"))?.name !== "useContext" ||
          t.isIdentifier(q.node.id)
        )
          return;
        const binding = q.scope.generateUidIdentifier("context");
        const declarations = [t.variableDeclarator(binding, q.node.init)];
        /** @param {any} pattern @param {any} value */ const unpack = (pattern, value) => {
          if (t.isIdentifier(pattern)) declarations.push(t.variableDeclarator(pattern, value));
          else if (t.isArrayPattern(pattern))
            pattern.elements.forEach((element, index) => {
              if (element)
                unpack(element, t.memberExpression(value, t.numericLiteral(index), true));
            });
          else if (t.isObjectPattern(pattern))
            for (const prop of pattern.properties) {
              if (t.isObjectProperty(prop))
                unpack(
                  prop.value,
                  t.memberExpression(value, prop.key, prop.computed || !t.isIdentifier(prop.key))
                );
            }
          else
            throw new Error(
              `[NATIVE_PATTERN] Context rest/default destructuring needs explicit value order. (${file})`
            );
        };
        unpack(q.node.id, binding);
        q.replaceWithMultiple(declarations);
      }
    });
    p.traverse({
      TryStatement: {
        exit(q) {
          const owner = q.getFunctionParent();
          if (!owner || owner.node.async) return; // ordinary async I/O retains its JS catch
          const handler = q.node.handler;
          if (!handler) return;
          if (q.node.finalizer)
            q.get("finalizer").traverse({
              Function(f) {
                f.skip();
              },
              ReturnStatement() {
                throw new Error(
                  `[NATIVE_CONTROL_TRANSFER] A return from finally needs completion lowering. (${file})`
                );
              }
            });
          const endings = [q.get("block"), q.get("handler.body")].map(block =>
            block.getCompletionRecords()
          );
          const throwsThrough = endings.every(
            ends => ends.length && ends.every(end => end.isThrowStatement())
          );
          const exitsThrough = endings.every(
            ends =>
              ends.length && ends.every(end => end.isReturnStatement() || end.isThrowStatement())
          );
          const result = q.scope.generateUidIdentifier("completion");
          const caught = q.scope.generateUidIdentifier("caught");
          const body = q.node.block;
          const handle = handler.body;
          let returns = false;
          // Encode an outer return, which cannot become a return from the helper only.
          for (const scope of [q.get("block"), q.get("handler.body")])
            scope.traverse({
              Function(f) {
                f.skip();
              },
              ReturnStatement(r) {
                returns = true;
                r.node.argument = t.objectExpression([
                  t.objectProperty(
                    t.identifier("returned"),
                    t.tsAsExpression(
                      t.booleanLiteral(true),
                      t.tsTypeReference(t.identifier("const"))
                    )
                  ),
                  t.objectProperty(
                    t.identifier("value"),
                    r.node.argument ?? t.identifier("undefined")
                  )
                ]);
              },
              BreakStatement(r) {
                if (
                  r.node.label ||
                  r.findParent(a => a === scope || a.isLoop() || a.isSwitchStatement()) === scope
                )
                  throw new Error(
                    `[NATIVE_CONTROL_TRANSFER] A catch crossing a loop/label needs completion lowering. (${file})`
                  );
              },
              ContinueStatement(r) {
                if (r.node.label || r.findParent(a => a === scope || a.isLoop()) === scope)
                  throw new Error(
                    `[NATIVE_CONTROL_TRANSFER] A labeled continue crossing a catch needs completion lowering. (${file})`
                  );
              }
            });
          const rethrows = new Set();
          if (t.isIdentifier(handler.param)) {
            const binding = q.get("handler").scope.getBinding(handler.param.name);
            if (binding?.referencePaths.every(r => r.parentPath?.isThrowStatement()))
              for (const ref of binding.referencePaths) rethrows.add(ref.parentPath?.node);
          }
          q.get("handler.body").traverse({
            ThrowStatement(r) {
              if (rethrows.has(r.node)) {
                used.add("raise");
                r.replaceWith(
                  t.returnStatement(t.callExpression(t.identifier("__nativeRethrow"), [caught]))
                );
              }
            }
          });
          const params = [];
          if (handler.param) {
            used.add("nativeFailureValue");
            handle.body.unshift(
              t.variableDeclaration("const", [
                t.variableDeclarator(
                  handler.param,
                  t.callExpression(t.identifier("__nativeValue"), [caught])
                )
              ])
            );
          }
          params.push(caught);
          if (returns && !exitsThrough)
            for (const block of [body, handle])
              block.body.push(
                t.returnStatement(
                  t.objectExpression([
                    t.objectProperty(
                      t.identifier("returned"),
                      t.tsAsExpression(
                        t.booleanLiteral(false),
                        t.tsTypeReference(t.identifier("const"))
                      )
                    )
                  ])
                )
              );
          used.add("nativeTry");
          const args = [
            t.functionExpression(null, [], body, true),
            t.functionExpression(null, params, handle, true)
          ];
          if (q.node.finalizer) args.push(t.functionExpression(null, [], q.node.finalizer, true));
          const call = t.callExpression(t.identifier("__nativeTry"), args);
          q.replaceWithMultiple(
            returns
              ? [
                  t.variableDeclaration("const", [t.variableDeclarator(result, call)]),
                  exitsThrough
                    ? t.returnStatement(t.memberExpression(result, t.identifier("value")))
                    : t.ifStatement(
                        t.memberExpression(result, t.identifier("returned")),
                        t.returnStatement(t.memberExpression(result, t.identifier("value")))
                      )
                ]
              : [throwsThrough ? t.returnStatement(call) : t.expressionStatement(call)]
          );
        }
      },
      CallExpression(q) {
        const a = api(q.get("callee"));
        if (a?.module !== "solid-js") return;
        if (a.name === "onSettled") {
          const callback = q.get("arguments.0");
          if (!callback?.isFunction()) return;
          used.add("$effect");
          used.add("$cleanup");
          if (t.isExpression(callback.node.body))
            callback.node.body = t.blockStatement([t.returnStatement(callback.node.body)]);
          callback.traverse({
            Function(n) {
              n.skip();
            },
            ReturnStatement(r) {
              if (r.node.argument) {
                r.replaceWithMultiple([
                  t.expressionStatement(
                    t.callExpression(t.identifier("__nativeCleanup"), [r.node.argument])
                  ),
                  t.returnStatement()
                ]);
                r.skip();
              }
            }
          });
          q.replaceWith(
            t.callExpression(t.identifier("__nativeEffect"), [
              t.arrowFunctionExpression([], t.blockStatement([])),
              callback.node
            ])
          );
          q.skip();
        }
      }
    });
    /** @type {Record<string,string>} */ const names = {
      nativeTry: "__nativeTry",
      nativeDispatch: "__nativeDispatch",
      nativeFailureValue: "__nativeValue",
      raise: "__nativeRethrow",
      $effect: "__nativeEffect",
      $cleanup: "__nativeCleanup"
    };
    for (const module of ["solid-yield", "solid-yield/internal"]) {
      const group = [...used]
        .filter(x =>
          module === "solid-yield" ? x === "raise" || x.startsWith("$") : x.startsWith("native")
        )
        .filter(x => {
          const binding = p.scope.getBinding(names[x]);
          if (!binding) return true;
          if (
            binding.path.isImportSpecifier() &&
            binding.path.parentPath.isImportDeclaration() &&
            binding.path.parentPath.node.source.value === module &&
            t.isIdentifier(binding.path.node.imported, { name: x })
          )
            return false;
          throw new Error(
            `[NATIVE_NAME] Reserve ${names[x]} for the generated native import. (${file})`
          );
        });
      if (group.length)
        p.node.body.unshift(
          t.importDeclaration(
            group.map(n => t.importSpecifier(t.identifier(names[n]), t.identifier(n))),
            t.stringLiteral(module)
          )
        );
    }
    out.set(file, printMapped(t.file(p.node)));
  }
  return out;
}
