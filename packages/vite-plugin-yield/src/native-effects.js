import { printMapped } from "./positions.js";
// @ts-check
import babel from "@babel/core";
import { relative } from "node:path";
import { parseProgram } from "./transform.js";
const t = babel.types;
/** @typedef {import('@babel/core').NodePath<any>} Path */
/** @param {Path | undefined} binding */
const imported = binding =>
  binding?.isImportSpecifier() &&
  binding.parentPath.isImportDeclaration() &&
  t.isIdentifier(binding.node.imported)
    ? { source: binding.parentPath.node.source.value, name: binding.node.imported.name }
    : null;
/** @param {Map<string,string>} files @param {import('compiler-yield/failure-inference').FailureReport} report */
export function lowerNativeEffects(files, report) {
  // Seed routine ownership from native primitive calls and propagate to callers
  // through the analyzer's resolved graph. Ordinary I/O helpers stay JavaScript.
  const routines = new Set();
  for (const [file, code] of files) {
    const program = parseProgram(code, file);
    program?.traverse({
      Function(q) {
        if (report.at(file, q.node.start ?? 0)?.component || q.node.generator)
          routines.add(`${file}:${q.node.start}`);
      },
      CallExpression(q) {
        const c = q.get("callee");
        const b = c.isIdentifier() ? c.scope.getBinding(c.node.name)?.path : undefined;
        const init = b?.isVariableDeclarator() ? b.get("init") : null;
        const producer = init?.isCallExpression() ? init.get("callee") : null;
        const sourceBinding = producer?.isIdentifier()
          ? producer.scope.getBinding(producer.node.name)?.path
          : undefined;
        const sourceApi = imported(sourceBinding);
        if (
          (imported(b)?.source === "solid-js" && imported(b)?.name !== "onCleanup") ||
          (sourceApi?.source === "solid-js" &&
            /^create(Signal|Memo|Optimistic|Store|Projection)/.test(sourceApi.name))
        ) {
          const owner = q.getFunctionParent();
          if (owner) routines.add(`${file}:${owner.node.start}`);
        }
      }
    });
  }
  let growing = true;
  while (growing) {
    growing = false;
    for (const f of report.functions) {
      if (f.calls.some(id => routines.has(id.replace("<root>", process.cwd())))) {
        const id = f.id.replace("<root>", process.cwd());
        if (!routines.has(id)) {
          routines.add(id);
          growing = true;
        }
      }
    }
  }
  const asyncRoutines = new Set();
  for (const [file, code] of files)
    parseProgram(code, file)?.traverse({
      Function(q) {
        const id = `${file}:${q.node.start}`;
        if (
          q.node.async &&
          !q.node.generator &&
          routines.has(id) &&
          !report.at(file, q.node.start ?? 0)?.server
        )
          asyncRoutines.add(id);
      }
    });
  const result = new Map();
  for (const [file, code] of files) {
    const p = parseProgram(code, file);
    if (!p) continue;
    const used = new Set();

    /** @param {string[]} kinds @param {any} value */
    const adapt = (kinds, value) => {
      used.add("nativeFailure");
      if (kinds.includes("ChunkError")) used.add("ChunkError");
      return t.callExpression(t.identifier("__nativeFailure"), [
        t.arrayExpression(kinds.map(k => t.stringLiteral(k))),
        value,
        ...(kinds.includes("ChunkError") ? [t.identifier("__nativeChunk")] : [])
      ]);
    };
    /** @param {string[]} kinds */
    const handler = kinds => {
      const e = t.identifier("error");
      e.typeAnnotation = t.tsTypeAnnotation(t.tsUnknownKeyword());
      return t.arrowFunctionExpression([e], adapt(kinds, t.identifier("error")));
    };
    /** @param {any} value @param {string[]} kinds */
    const attempt = (value, kinds) => {
      used.add("attempt");
      return t.callExpression(t.identifier("__nativeAttempt"), [
        t.arrowFunctionExpression([], value),
        handler(kinds)
      ]);
    };
    /** Known routine hosts; foreign callbacks remain plain and are caught at their call. @param {Path | null} fn */
    const host = fn => {
      if (!fn || fn.node.async || fn.isClassMethod() || fn.isObjectMethod()) return false;
      if (routines.has(`${file}:${fn.node.start}`)) return true;
      const call = fn.parentPath;
      if (call?.isCallExpression()) {
        const callee = call.get("callee");
        /** @type {Path | undefined} */
        const binding = callee.isIdentifier()
          ? callee.scope.getBinding(callee.node.name)?.path
          : undefined;
        const api = imported(binding);
        if (api?.source === "solid-yield/internal" && api.name === "nativeTry") return true;
        if (api?.source === "solid-js")
          return [
            "createMemo",
            "createEffect",
            "createProjection",
            "createOptimisticStore",
            "action"
          ].includes(api.name);
      }
      return (
        call?.isJSXExpressionContainer() &&
        call.parentPath.isJSXAttribute() &&
        /^on/.test(String(call.parentPath.node.name.name ?? ""))
      );
    };

    // Async reactive helpers run on their caller's host. Await becomes an
    // attempt at its original position; setup cannot admit that read/wait.
    p.traverse({
      CallExpression(q) {
        const info = report.call(file, q.node.start ?? 0, q.node.end ?? 0);
        const owner = q.getFunctionParent();
        if (
          info?.target &&
          asyncRoutines.has(info.target) &&
          owner &&
          report.at(file, owner.node.start ?? 0)?.component
        )
          throw new Error(
            `[NATIVE_ASYNC_SETUP] An async reactive read has setup as its host; call it from an event or memo. (${file}:${q.node.loc?.start.line}:${(q.node.loc?.start.column ?? 0) + 1})`
          );
      },
      Function(q) {
        if (!asyncRoutines.has(`${file}:${q.node.start}`)) return;
        q.node.async = false;
        if (q.isArrowFunctionExpression()) q.arrowFunctionToExpression();
        q.node.generator = true;
        q.node.returnType = null;
      }
    });
    // Synchronous native throw sites are ordinary library raise operations.
    p.traverse({
      AwaitExpression: {
        exit(q) {
          const fn = q.getFunctionParent();
          if (!fn || !asyncRoutines.has(`${file}:${fn.node.start}`)) return;
          const value = q.node.argument;
          const info = report.call(file, value.start ?? 0, value.end ?? 0);
          q.replaceWith(
            (info?.target && asyncRoutines.has(info.target)) ||
              (t.isCallExpression(value) &&
                t.isIdentifier(value.callee, { name: "__nativeAttempt" }))
              ? value
              : attempt(value, info?.fails ?? ["unknown"])
          );
        }
      },
      Function(q) {
        if (!q.node.async && !q.node.returnType && t.isBlockStatement(q.node.body)) {
          // Babel's completion query removes switch breaks. This check must
          // only inspect control flow: ordinary helpers retain their JS body.
          /** @param {any} node @returns {boolean} */
          const throws = node =>
            t.isThrowStatement(node) ||
            (t.isBlockStatement(node) && throws(node.body.at(-1))) ||
            (t.isIfStatement(node) && throws(node.consequent) && throws(node.alternate));
          if (throws(q.node.body)) q.node.returnType = t.tsTypeAnnotation(t.tsNeverKeyword());
        }
      },
      YieldExpression: {
        exit(q) {
          const fn = q.getFunctionParent();
          if (!fn || fn.node.async || q.node.delegate || !q.node.argument) return;
          const value = q.node.argument;
          q.replaceWith(
            t.isCallExpression(value) && t.isIdentifier(value.callee, { name: "__nativeAttempt" })
              ? value
              : attempt(value, ["unknown"])
          );
        }
      },
      ThrowStatement(q) {
        const fn = q.getFunctionParent();
        if (!host(fn)) return;
        if (
          t.isStringLiteral(q.node.argument) ||
          t.isNumericLiteral(q.node.argument) ||
          t.isBooleanLiteral(q.node.argument) ||
          t.isNullLiteral(q.node.argument)
        ) {
          const error = new Error(
            "Throw an Error object so callers can identify and handle this failure."
          );
          Object.assign(error, {
            code: "NATIVE_THROW",
            id: file,
            loc: { file, ...q.node.loc?.start }
          });
          throw error;
        }
        used.add("raise");
        if (fn) fn.node.returnType = null;
        const raised = t.callExpression(t.identifier("__nativeRaise"), [
          adapt(report.throws(file, q.node.start ?? 0, q.node.end ?? 0), q.node.argument)
        ]);
        // raise always throws at runtime; preserve that non-returning path in a
        // component whose successful return must be a view.
        q.replaceWith(
          t.returnStatement(
            report.at(file, fn?.node.start ?? 0)?.component
              ? t.tsAsExpression(raised, t.tsNeverKeyword())
              : raised
          )
        );
      },
      ClassDeclaration(q) {
        const info = report.classes.find(
          c => c.file === relative(process.cwd(), file) && c.nameStart === q.node.id?.start
        );
        if (info && q.node.id) {
          used.add("registerNativeFailure");
          q.insertAfter(
            t.expressionStatement(
              t.callExpression(t.identifier("__nativeRegister"), [
                t.stringLiteral(info.id),
                t.identifier(q.node.id.name)
              ])
            )
          );
        }
      },
      ClassExpression(q) {
        const info = report.classes.find(
          c => c.file === relative(process.cwd(), file) && c.classStart === q.node.start
        );
        if (info) {
          used.add("registerNativeFailure");
          q.replaceWith(
            t.callExpression(t.identifier("__nativeRegister"), [t.stringLiteral(info.id), q.node])
          );
          q.skip();
        }
      },
      "CallExpression|NewExpression": {
        exit(q) {
          const fn = q.getFunctionParent();
          if (!host(fn) || !q.node.start) return;
          const c = q.get("callee");
          if (
            c.isIdentifier() &&
            imported(c.scope.getBinding(c.node.name)?.path)?.source.startsWith("solid-yield")
          )
            return;
          // Preserve a method chain's receiver and evaluation order. Wrap the
          // completed call, not an inner call that would become an iterator.
          let chain = q.parentPath;
          while (chain?.isMemberExpression()) {
            if (chain.parentPath?.isCallExpression() && chain.parentPath.node.callee === chain.node)
              return;
            chain = chain.parentPath;
          }
          const info = report.call(file, q.node.start, q.node.end ?? 0);
          if (
            !info ||
            info.native ||
            (!info.fails.length && !info.promise) ||
            (info.target && asyncRoutines.has(info.target)) ||
            (info.target &&
              routines.has(info.target) &&
              !info.async &&
              !info.promise &&
              !q.isNewExpression())
          )
            return;
          // Evaluate the call target and arguments in the current routine. A
          // plain attempt producer must not capture delegated reactive reads.
          // Retain receiver lookup before arguments, and invoke with that receiver.
          const call =
            /** @type {import("@babel/core").types.CallExpression | import("@babel/core").types.NewExpression} */ (
              q.node
            );
          let readsArgument = false;
          for (const arg of q.get("arguments")) {
            if (arg.isFunction()) continue;
            if (arg.isCallExpression() || arg.isMemberExpression()) readsArgument = true;
            arg.traverse({
              Function(f) {
                f.skip();
              },
              CallExpression() {
                readsArgument = true;
              },
              MemberExpression() {
                readsArgument = true;
              }
            });
          }
          if (readsArgument && !call.arguments.some(a => t.isSpreadElement(a))) {
            /** @type {import('@babel/core').types.Statement[]} */
            const statements = [];
            /** @param {any} value @param {string} hint */
            const save = (value, hint) => {
              const id = q.scope.generateUidIdentifier(hint);
              statements.push(t.variableDeclaration("const", [t.variableDeclarator(id, value)]));
              return id;
            };
            let callee = /** @type {import("@babel/core").types.Expression} */ (call.callee);
            let receiver;
            if (t.isMemberExpression(callee) && !t.isSuper(callee.object)) {
              receiver = save(callee.object, "receiver");
              callee = save(
                attempt(t.memberExpression(receiver, callee.property, callee.computed), info.fails),
                "method"
              );
            }
            if (!receiver) callee = save(callee, "callee");
            const args = call.arguments.map(arg => save(arg, "argument"));
            if (receiver) used.add("nativeInvoke");
            const invoke = t.isNewExpression(call)
              ? t.newExpression(callee, args)
              : receiver
                ? t.callExpression(t.identifier("__nativeInvoke"), [
                    callee,
                    receiver,
                    t.arrayExpression(args)
                  ])
                : t.callExpression(callee, args);
            statements.push(t.returnStatement(attempt(invoke, info.fails)));
            q.replaceWith(
              t.callExpression(
                t.functionExpression(null, [], t.blockStatement(statements), true),
                []
              )
            );
          } else q.replaceWith(attempt(call, info.fails));
          q.skip();
        }
      }
    });
    // Server producers brand at the rejection boundary before serialization.
    // Their bodies stay plain async JavaScript; only client calls use attempt.
    p.traverse({
      Function(q) {
        const summary = report.at(file, q.node.start ?? 0);
        if (!summary?.server || !q.node.async || !t.isBlockStatement(q.node.body)) return;
        const body = q.node.body;
        const error = t.identifier("__nativeRejection");
        q.node.body = t.blockStatement(
          [
            t.tryStatement(
              t.blockStatement(body.body),
              t.catchClause(
                error,
                t.blockStatement([t.throwStatement(adapt([...summary.fails], error))])
              )
            )
          ],
          body.directives
        );
        q.skip();
      }
    });
    // An async event remains an ordinary producer behind one generated attempt.
    p.traverse({
      JSXAttribute(q) {
        if (!/^on[A-Z]/.test(String(q.node.name.name)) || !t.isJSXExpressionContainer(q.node.value))
          return;
        const value = q.get("value.expression");
        /** @type {Path} */
        let fn = value;
        if (value.isIdentifier()) {
          const binding = value.scope.getBinding(value.node.name)?.path;
          if (binding?.isFunctionDeclaration()) fn = binding;
          else if (binding?.isVariableDeclarator()) fn = binding.get("init");
        }
        if (!fn?.isFunction() || !fn.node.async) return;
        const summary = report.at(file, fn.node.start ?? 0);
        const kinds = [...(summary?.fails ?? new Set(["unknown"]))];
        if (summary?.server) kinds.push("ChunkError");
        // Keep parameter annotations and contextual event typing where available.
        if (value.isFunction()) {
          used.add("attempt");
          const params = value.node.params.map((param, index) =>
            t.isIdentifier(param) ? t.cloneNode(param) : t.identifier(`arg${index}`)
          );
          const args = params.map(param => t.identifier(param.name));
          const call = t.callExpression(value.node, args);
          value.replaceWith(t.arrowFunctionExpression(params, attempt(call, kinds)));
        } else if (value.isIdentifier()) {
          const args = t.identifier("args");
          args.typeAnnotation = t.tsTypeAnnotation(
            t.tsTypeReference(
              t.identifier("Parameters"),
              t.tsTypeParameterInstantiation([t.tsTypeQuery(t.identifier(value.node.name))])
            )
          );
          value.replaceWith(
            t.arrowFunctionExpression(
              [t.restElement(args)],
              attempt(t.callExpression(value.node, [t.spreadElement(t.identifier("args"))]), kinds)
            )
          );
        }
        value.skip();
      }
    });
    // An async memo remains an ordinary async producer, behind a typed attempt.
    p.traverse({
      CallExpression(q) {
        const callee = q.get("callee");
        /** @type {Path | undefined} */
        const binding = callee.isIdentifier()
          ? callee.scope.getBinding(callee.node.name)?.path
          : undefined;
        const api = imported(binding);
        if (
          api?.source !== "solid-js" ||
          !["createMemo", "createProjection", "createOptimisticStore"].includes(api.name)
        )
          return;
        const callback = q.get("arguments.0");
        if (!callback?.isFunction() || !callback.node.async) return;
        const summary = report.at(file, callback.node.start ?? 0);
        const kinds = [...(summary?.fails ?? new Set(["unknown"]))];
        used.add("attempt");
        callback.replaceWith(
          t.arrowFunctionExpression(
            [],
            t.callExpression(t.identifier("__nativeAttempt"), [callback.node, handler(kinds)])
          )
        );
        callback.skip();
      }
    });
    // A plain Errored fallback sees the author's original value in this realm.
    p.traverse({
      JSXAttribute(q) {
        if (
          q.node.name.name !== "fallback" ||
          !q.parentPath.isJSXOpeningElement() ||
          q.parentPath.node.name.type !== "JSXIdentifier"
        )
          return;
        /** @type {Path | undefined} */
        const binding = q.scope.getBinding(q.parentPath.node.name.name)?.path;
        if (imported(binding)?.name !== "Errored") return;
        const value = q.get("value");
        if (!value.isJSXExpressionContainer()) return;
        const fn = value.get("expression");
        if (!fn.isFunction() || !t.isIdentifier(fn.node.params[0])) return;
        const param = fn.node.params[0].name;
        fn.traverse({
          CallExpression(site) {
            if (site.get("callee").isIdentifier({ name: param })) {
              used.add("nativeFailureValue");
              site.replaceWith(t.callExpression(t.identifier("__nativeValue"), [site.node]));
              site.skip();
            }
          }
        });
      }
    });
    /** @type {Record<string,string>} */
    const aliases = {
      ChunkError: "__nativeChunk",
      attempt: "__nativeAttempt",
      raise: "__nativeRaise",
      nativeFailure: "__nativeFailure",
      registerNativeFailure: "__nativeRegister",
      nativeFailureValue: "__nativeValue",
      nativeInvoke: "__nativeInvoke"
    };
    for (const module of ["solid-yield", "solid-yield/internal"]) {
      const names = [...used].filter(n =>
        module === "solid-yield"
          ? ["attempt", "raise", "ChunkError"].includes(n)
          : !["attempt", "raise", "ChunkError"].includes(n)
      );
      for (const name of [...names]) {
        const binding = p.scope.getBinding(aliases[name]);
        if (!binding) continue;
        const api = imported(binding.path);
        if (api?.source === module && api.name === name) names.splice(names.indexOf(name), 1);
        else
          throw new Error(
            `[NATIVE_NAME] Reserve ${aliases[name]} for the generated native import. (${file})`
          );
      }
      if (names.length)
        p.node.body.unshift(
          t.importDeclaration(
            names.map(n => t.importSpecifier(t.identifier(aliases[n]), t.identifier(n))),
            t.stringLiteral(module)
          )
        );
    }
    result.set(file, printMapped(t.file(p.node)));
  }
  return result;
}
