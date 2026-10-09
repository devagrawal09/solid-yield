import { traverseOwned } from "./native-owned.js";
import { printMapped, copyPosition } from "./positions.js";
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
    traverseOwned(program, {
      Function(q) {
        if (report.at(file, q.node.start ?? 0)?.component) routines.add(`${file}:${q.node.start}`);
      },
      CallExpression(q) {
        const c = q.get("callee");
        if (
          c.isIdentifier() &&
          !c.scope.getBinding(c.node.name) &&
          /^(setTimeout|setInterval|requestAnimationFrame|requestIdleCallback)$/.test(c.node.name)
        ) {
          /** @type {Path | undefined} */ let callback = q.get("arguments.0");
          if (callback?.isIdentifier()) {
            const declaration = callback.scope.getBinding(callback.node.name)?.path;
            callback = declaration?.isVariableDeclarator() ? declaration.get("init") : declaration;
          }
          if (callback?.isFunction()) routines.add(`${file}:${callback.node.start}`);
        }
        const b = c.isIdentifier() ? c.scope.getBinding(c.node.name)?.path : undefined;
        const init = b?.isVariableDeclarator() ? b.get("init") : null;
        const producer = init?.isCallExpression() ? init.get("callee") : null;
        const sourceBinding = producer?.isIdentifier()
          ? producer.scope.getBinding(producer.node.name)?.path
          : undefined;
        const sourceApi = imported(sourceBinding);
        if (
          (imported(b)?.source === "solid-js" && imported(b)?.name !== "onCleanup") ||
          (!!init?.getFunctionParent() &&
            sourceApi?.source === "solid-js" &&
            /^create(Signal|Memo|Optimistic|Store|Projection)/.test(sourceApi.name))
        ) {
          const owner = q.getFunctionParent();
          if (owner) routines.add(`${file}:${owner.node.start}`);
          if (sourceApi?.name === "createMemo" || imported(b)?.name === "createMemo") {
            const callback = q.get("arguments.0");
            if (callback?.isFunction() && callback.node.async)
              routines.add(`${file}:${callback.node.start}`);
          }
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
    let domException = false;
    /** @type {Map<any, {id: import("@babel/core").types.Identifier, kinds: Set<string>}>} */
    const detached = new Map();

    /** @param {string[]} kinds @param {any} value */
    const adapt = (kinds, value) => {
      used.add("nativeFailure");
      if (kinds.includes("global:DOMException")) {
        used.add("registerNativeFailure");
        domException = true;
      }
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
      // Function-valued JSX children and attributes are called by the renderer.
      // Parentheses, conditionals and functions returned from a hole keep that host.
      for (let outer = fn.parentPath; outer; outer = outer.parentPath) {
        if (!outer.isJSXExpressionContainer()) continue;
        const attr = outer.parentPath;
        // These already have explicit callback bridges in the native surface.
        // Their nested JSX expressions still provide holes of their own.
        if (attr.isJSXAttribute()) {
          if (attr.node.name.name === "ref") return false;
          const tag = attr.parentPath.get("name");
          const binding = tag.isJSXIdentifier()
            ? tag.scope.getBinding(tag.node.name)?.path
            : undefined;
          if (
            attr.node.name.name === "fallback" &&
            imported(binding)?.source === "solid-js" &&
            imported(binding)?.name === "Errored"
          )
            return false;
        }
        return true;
      }
      return false;
    };

    // Async reactive helpers run on their caller's host. Await becomes an
    // attempt at its original position; setup cannot admit that read/wait.
    traverseOwned(p, {
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
        const call = q.parentPath;
        const callee = call.isCallExpression() ? call.get("callee") : null;
        const api = callee?.isIdentifier()
          ? imported(callee.scope.getBinding(callee.node.name)?.path)
          : null;
        const producer =
          api?.source === "solid-js" &&
          ["createMemo", "createProjection", "createOptimisticStore"].includes(api.name);
        const kinds = [...(report.at(file, q.node.start ?? 0)?.fails ?? [])];
        q.node.async = false;
        if (q.isArrowFunctionExpression()) q.arrowFunctionToExpression();
        q.node.generator = true;
        q.node.returnType = null;
        // An async producer still returns a promise when it has no await.
        // Resolve the value after its authored reads, preserving that pending
        // boundary without putting a delegated read inside a plain thunk.
        if (producer && t.isBlockStatement(q.node.body)) {
          const endings = q.get("body").getCompletionRecords();
          const exitsThrough =
            endings.length &&
            endings.every(end => end.isReturnStatement() || end.isThrowStatement());
          /** @param {import("@babel/core").types.Expression} value */
          const completion = value =>
            attempt(
              t.callExpression(
                t.memberExpression(t.identifier("Promise"), t.identifier("resolve")),
                [value]
              ),
              kinds
            );
          q.traverse({
            Function(inner) {
              inner.skip();
            },
            ReturnStatement(returned) {
              const result = returned.scope.generateUidIdentifier("asyncResult");
              if (
                t.isArrayExpression(returned.node.argument) &&
                !returned.node.argument.elements.length
              )
                result.typeAnnotation = t.tsTypeAnnotation(t.tsArrayType(t.tsNeverKeyword()));
              returned.replaceWith(
                t.blockStatement([
                  t.variableDeclaration("const", [
                    t.variableDeclarator(
                      result,
                      returned.node.argument ?? t.unaryExpression("void", t.numericLiteral(0))
                    )
                  ]),
                  t.returnStatement(completion(t.identifier(result.name)))
                ])
              );
              returned.skip();
            }
          });
          if (!exitsThrough)
            q.node.body.body.push(
              t.returnStatement(completion(t.unaryExpression("void", t.numericLiteral(0))))
            );
        }
      }
    });
    // Synchronous native throw sites are ordinary library raise operations.
    traverseOwned(p, {
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
          if (!fn || !host(fn) || fn.node.async || q.node.delegate || !q.node.argument) return;
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
        const raised = copyPosition(
          t.callExpression(t.identifier("__nativeRaise"), [
            adapt(report.throws(file, q.node.start ?? 0, q.node.end ?? 0), q.node.argument)
          ]),
          q.node
        );
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
          if (
            !host(fn) ||
            !q.node.start ||
            p.node.directives.some(d => d.value.value === "use pure")
          )
            return;
          const c = q.get("callee");
          // Promise combinators own their member promises. Awaiting members one
          // by one here would lose concurrency and the tuple result type.
          const combinator = q.findParent(
            a =>
              a.isCallExpression() &&
              t.isMemberExpression(a.node.callee) &&
              t.isIdentifier(a.node.callee.object, { name: "Promise" }) &&
              t.isIdentifier(a.node.callee.property) &&
              ["all", "allSettled", "race", "any"].includes(a.node.callee.property.name)
          );
          if (combinator) return;
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
          const kinds = info?.ownFails ?? info?.fails ?? [];
          // A reactive Promise continuation keeps its lexical host (sugar.js
          // wraps it as a lexical callback); it is not a separate event.
          if (
            !info ||
            !info.callable ||
            info.native ||
            (!kinds.length && !info.promise) ||
            (info.target && asyncRoutines.has(info.target)) ||
            (info.target &&
              routines.has(info.target) &&
              !info.async &&
              !info.promise &&
              !q.isNewExpression())
          )
            return;
          const unawaited =
            info.promise &&
            c.isMemberExpression() &&
            t.isIdentifier(c.node.property) &&
            ["then", "catch", "finally"].includes(c.node.property.name) &&
            q.parentPath?.isExpressionStatement();
          /** @type {{id: import("@babel/core").types.Identifier, kinds: Set<string>} | undefined} */
          let pending;
          if (unawaited && fn) {
            pending = detached.get(fn.node);
            if (!pending) {
              pending = { id: fn.scope.generateUidIdentifier("pendingChains"), kinds: new Set() };
              detached.set(fn.node, pending);
            }
            for (const kind of kinds) pending.kinds.add(kind);
          }
          // Evaluate the call target and arguments in the current routine. A
          // plain attempt producer must not capture delegated reactive reads.
          // Retain receiver lookup before arguments, and invoke with that receiver.
          const call =
            /** @type {import("@babel/core").types.CallExpression | import("@babel/core").types.NewExpression} */ (
              q.node
            );
          let readsArgument = false;
          // A chained receiver can contain the event's reactive arguments too.
          // Evaluate it in the routine before building the plain producer.
          const evaluated = [...q.get("arguments")];
          if (c.isMemberExpression()) {
            const receiver = c.get("object");
            // Only lift a reactive receiver. Splitting a plain Promise method
            // erases its generic return type even though it has no routine read.
            /** @param {Path} value */
            const reactiveValue = value => {
              if (!value.isIdentifier()) return false;
              const binding = value.scope.getBinding(value.node.name)?.path;
              const direct = imported(binding);
              // Construction is not a receiver read. Keep invalid creation in
              // a hole at its authored call, rather than lifting it into setup.
              if (
                (direct?.source === "solid-js" && !/^create/.test(direct.name)) ||
                direct?.source.startsWith("solid-yield")
              )
                return true;
              const init = binding?.isVariableDeclarator() ? binding.get("init") : null;
              const api = init?.isCallExpression() ? init.get("callee") : null;
              const source = api?.isIdentifier()
                ? imported(api.scope.getBinding(api.node.name)?.path)
                : null;
              return (
                source?.source === "solid-js" &&
                /^create(Signal|Memo|Optimistic|Store|Projection)/.test(source.name)
              );
            };
            /** @param {Path} value */
            const readsReceiver = value => {
              if (report.foreignState(file, value.node.start ?? 0, value.node.end ?? 0))
                readsArgument = true;
              if (value.isCallExpression()) {
                const site = report.call(file, value.node.start ?? 0, value.node.end ?? 0);
                if (
                  reactiveValue(value.get("callee")) ||
                  (site?.target && routines.has(site.target))
                )
                  readsArgument = true;
              } else if (value.isMemberExpression()) {
                let base = value.get("object");
                while (base.isMemberExpression()) base = base.get("object");
                if (reactiveValue(base)) readsArgument = true;
              }
            };
            readsReceiver(receiver);
            traverseOwned(receiver, {
              Function(inner) {
                inner.skip();
              },
              CallExpression: readsReceiver,
              MemberExpression: readsReceiver,
              ReferencedIdentifier: readsReceiver
            });
          }
          let receiverCall = c.isMemberExpression() ? c.get("object") : null;
          while (receiverCall?.isCallExpression()) {
            evaluated.push(...receiverCall.get("arguments"));
            const target = receiverCall.get("callee");
            receiverCall = target.isMemberExpression() ? target.get("object") : null;
          }
          for (const arg of evaluated) {
            if (arg.isFunction()) continue;
            if (arg.isCallExpression() || arg.isMemberExpression()) readsArgument = true;
            traverseOwned(arg, {
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
            const platformPromise =
              t.isMemberExpression(callee) &&
              t.isIdentifier(callee.object, { name: "Promise" }) &&
              t.isIdentifier(callee.property) &&
              ["all", "allSettled", "race", "any"].includes(callee.property.name);
            // Only the receiver reads, and every argument is a function literal:
            // evaluating those has no effect, so the call keeps its own order, and
            // a continuation stays where its lexical host wraps it (review 3 #07).
            const inlineCallbacks =
              t.isMemberExpression(callee) &&
              !t.isSuper(callee.object) &&
              !platformPromise &&
              !t.isNewExpression(call) &&
              call.arguments.length > 0 &&
              call.arguments.every(a => t.isFunction(a));
            if (inlineCallbacks && t.isMemberExpression(callee)) {
              receiver = save(callee.object, "receiver");
              callee = t.memberExpression(receiver, callee.property, callee.computed);
            } else if (
              t.isMemberExpression(callee) &&
              !t.isSuper(callee.object) &&
              !platformPromise
            ) {
              receiver = save(callee.object, "receiver");
              callee = save(
                attempt(t.memberExpression(receiver, callee.property, callee.computed), kinds),
                "method"
              );
            }
            if (!receiver && !platformPromise) callee = save(callee, "callee");
            const args = inlineCallbacks
              ? /** @type {any[]} */ (call.arguments)
              : call.arguments.map(arg => save(arg, "argument"));
            if (receiver && !inlineCallbacks) used.add("nativeInvoke");
            const invoke = t.isNewExpression(call)
              ? t.newExpression(callee, args)
              : receiver && !inlineCallbacks
                ? t.callExpression(t.identifier("__nativeInvoke"), [
                    callee,
                    receiver,
                    t.arrayExpression(args)
                  ])
                : t.callExpression(callee, args);
            /** @type {any} */ let value = invoke;
            if (
              info.promise &&
              (platformPromise ||
                (receiver &&
                  t.isMemberExpression(call.callee) &&
                  t.isIdentifier(call.callee.property) &&
                  ["then", "catch", "finally"].includes(call.callee.property.name)))
            ) {
              const annotation = parseProgram(`const result = null as ${info.resultType};`, file);
              const cast = annotation?.node.body[0];
              if (t.isVariableDeclaration(cast) && t.isTSAsExpression(cast.declarations[0].init))
                value = t.tsAsExpression(invoke, cast.declarations[0].init.typeAnnotation);
            }
            statements.push(t.returnStatement(unawaited ? value : attempt(value, kinds)));
            q.replaceWith(
              t.callExpression(
                t.functionExpression(null, [], t.blockStatement(statements), true),
                []
              )
            );
          } else if (!unawaited) q.replaceWith(attempt(call, kinds));
          if (pending)
            q.replaceWith(
              t.callExpression(t.memberExpression(pending.id, t.identifier("push")), [
                /** @type {import("@babel/core").types.Expression} */ (q.node)
              ])
            );
          q.skip();
        }
      }
    });
    traverseOwned(p, {
      MemberExpression: {
        exit(q) {
          const object = q.get("object");
          if (
            !host(q.getFunctionParent()) ||
            !report.foreignState(file, object.node.start ?? 0, object.node.end ?? 0)
          )
            return;
          if (q.parentPath.isCallExpression() && q.parentPath.node.callee === q.node) return;
          q.replaceWith(attempt(q.node, ["unknown"]));
          q.skip();
        }
      },
      SpreadElement(q) {
        const value = q.get("argument");
        if (
          !host(q.getFunctionParent()) ||
          !report.foreignState(file, value.node.start ?? 0, value.node.end ?? 0)
        )
          return;
        value.replaceWith(attempt(value.node, ["unknown"]));
        q.skip();
      }
    });
    // Drain ignored chains on the enclosing host after the authored body. A
    // catch around creating a promise cannot catch its later rejection.
    for (const [body, pending] of detached) {
      const declaration = t.variableDeclaration("const", [
        t.variableDeclarator(pending.id, t.arrayExpression([]))
      ]);
      pending.id.typeAnnotation = t.tsTypeAnnotation(
        t.tsArrayType(
          t.tsTypeReference(
            t.identifier("Promise"),
            t.tsTypeParameterInstantiation([t.tsUnknownKeyword()])
          )
        )
      );
      const finish = t.blockStatement([
        t.expressionStatement(
          attempt(
            t.callExpression(t.memberExpression(t.identifier("Promise"), t.identifier("all")), [
              t.identifier(pending.id.name)
            ]),
            [...pending.kinds]
          )
        )
      ]);
      body.body = t.blockStatement([declaration, t.tryStatement(body.body, null, finish)]);
    }
    // Server producers brand at the rejection boundary before serialization.
    // Their bodies stay plain async JavaScript; only client calls use attempt.
    traverseOwned(p, {
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
    traverseOwned(p, {
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
    traverseOwned(p, {
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
    traverseOwned(p, {
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
        traverseOwned(fn, {
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
      $event: "__nativePromiseEvent",
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
          ? ["$event", "attempt", "raise", "ChunkError"].includes(n)
          : !["$event", "attempt", "raise", "ChunkError"].includes(n)
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
    if (domException)
      p.node.body.push(
        t.ifStatement(
          t.binaryExpression(
            "!==",
            t.unaryExpression("typeof", t.identifier("DOMException")),
            t.stringLiteral("undefined")
          ),
          t.expressionStatement(
            t.callExpression(t.identifier("__nativeRegister"), [
              t.stringLiteral("global:DOMException"),
              t.identifier("DOMException")
            ])
          )
        )
      );
    result.set(file, printMapped(t.file(p.node)));
  }
  return result;
}
