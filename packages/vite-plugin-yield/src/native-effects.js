import { traverseOwned, awaitDirective } from "./native-owned.js";
import { printMapped, copyPosition, nativeRefusal } from "./positions.js";
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
// A flow control's row parameter (`<For each={…}>{row => …}</For>`): a path
// in the model, read in the row, so a call on it lifts its receiver.
/** @param {import("@babel/core").NodePath<any> | undefined} param */
const flowRow = param => {
  const fn = param?.parentPath;
  if (!fn?.isFunction() || param?.listKey !== "params") return false;
  const element = fn.parentPath?.isJSXExpressionContainer() ? fn.parentPath.parentPath : null;
  const name = element?.isJSXElement() ? element.node.openingElement.name : null;
  if (!t.isJSXIdentifier(name)) return false;
  const control = imported(element?.scope.getBinding(name.name)?.path);
  return (
    control?.source === "solid-js" && ["For", "Index", "Repeat", "Show"].includes(control.name)
  );
};
/** Known routine hosts; foreign callbacks remain plain and are caught at their call.
 * @param {Set<string>} routines @param {string} file @param {Path | null} fn */
const hostOf = (routines, file, fn) => {
  if (!fn || fn.node.async || fn.isClassMethod() || fn.isObjectMethod()) return false;
  if (routines.has(`${file}:${fn.node.start}`)) return true;
  const field = fn.parentPath;
  const name = field?.isObjectProperty()
    ? t.isIdentifier(field.node.key)
      ? field.node.key.name
      : t.isStringLiteral(field.node.key)
        ? field.node.key.value
        : ""
    : "";
  if (
    field?.isObjectProperty() &&
    field.node.value === fn.node &&
    !field.node.computed &&
    /^on[A-Z]/.test(name)
  ) {
    const object = field.parentPath;
    const declaration = object.parentPath;
    const binding =
      declaration?.isVariableDeclarator() && t.isIdentifier(declaration.node.id)
        ? declaration.scope.getBinding(declaration.node.id.name)
        : undefined;
    // Match the surface's inline objects and constants used only in DOM spreads.
    const uses = binding?.constant ? binding.referencePaths : [object];
    if (
      uses.length &&
      uses.every(ref => {
        const spread = ref.parentPath;
        return (
          spread?.isJSXSpreadAttribute() &&
          t.isJSXOpeningElement(spread.parent) &&
          t.isJSXIdentifier(spread.parent.name) &&
          /^[a-z]/.test(spread.parent.name.name)
        );
      })
    )
      return true;
  }
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
        "createRenderEffect",
        "createProjection",
        "createOptimisticStore",
        "action"
      ].includes(api.name);
  }
  // Function-valued JSX children and attributes are called by the renderer.
  // Parentheses, conditionals and functions returned from a hole keep that host.
  for (let outer = fn.parentPath; outer; outer = outer.parentPath) {
    if (outer.isJSXSpreadAttribute()) return false;
    if (!outer.isJSXExpressionContainer()) continue;
    const attr = outer.parentPath;
    // These already have explicit callback bridges in the native surface.
    // Their nested JSX expressions still provide holes of their own.
    if (attr.isJSXAttribute()) {
      if (attr.node.name.name === "ref") return false;
      const tag = attr.parentPath.get("name");
      const binding = tag.isJSXIdentifier() ? tag.scope.getBinding(tag.node.name)?.path : undefined;
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
/** @param {Map<string,string>} files @param {import('compiler-yield/failure-inference').FailureReport} report */
export function lowerNativeEffects(files, report) {
  // Seed routine ownership from native primitive calls and propagate to callers
  // through the analyzer's resolved graph. Ordinary I/O helpers stay JavaScript.
  const routines = new Set();
  // An array's own method runs its callbacks at once, in its caller's host
  // (`items.every(x => …)`, `reduce`, `sort`). In a host, a callback that may
  // fail is a routine too: what it throws is a typed raise there, which the
  // host takes as it takes a reading callback's (routines.js delegates both).
  /** @type {{ file: string, owner: Path, callback: string }[]} */
  const runAtOnce = [];
  for (const [file, code] of files) {
    const program = parseProgram(code, file);
    traverseOwned(program, {
      Function(q) {
        if (report.at(file, q.node.start ?? 0)?.component) routines.add(`${file}:${q.node.start}`);
        // Native DOM event callbacks own their await boundary even when the
        // only reactive callee acquires its routine type in a later pass.
        const expression = q.parentPath,
          attribute = expression?.parentPath;
        const opening = attribute?.parentPath;
        if (
          q.node.async &&
          expression?.isJSXExpressionContainer() &&
          expression.node.expression === q.node &&
          attribute?.isJSXAttribute() &&
          t.isJSXIdentifier(attribute.node.name) &&
          /^on[A-Z]/.test(attribute.node.name.name) &&
          opening?.isJSXOpeningElement() &&
          t.isJSXIdentifier(opening.node.name) &&
          /^[a-z]/.test(opening.node.name.name)
        )
          routines.add(`${file}:${q.node.start}`);
      },
      CallExpression(q) {
        const c = q.get("callee");
        if (c.isMemberExpression()) {
          const failing = q
            .get("arguments")
            .filter(
              a =>
                a.isFunction() &&
                !a.node.async &&
                !a.node.generator &&
                !!report.at(file, a.node.start ?? 0)?.fails.size
            );
          const owner = q.getFunctionParent();
          if (
            owner &&
            failing.length &&
            report.call(file, q.node.start ?? 0, q.node.end ?? 0)?.arrayMethod
          )
            for (const callback of failing)
              runAtOnce.push({ file, owner, callback: `${file}:${callback.node.start}` });
        }
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
        // `onCleanup` makes a routine (the library's `$cleanup`), but in a
        // Promise executor it stays Solid's owner cleanup (native.js).
        const executor = (() => {
          const owner = q.getFunctionParent();
          return (
            !!owner?.parentPath?.isNewExpression() &&
            t.isIdentifier(owner.parentPath.node.callee, { name: "Promise" })
          );
        })();
        if (
          (imported(b)?.source === "solid-js" &&
            (imported(b)?.name !== "onCleanup" || !executor)) ||
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
  for (let grew = true; grew; ) {
    grew = false;
    for (const { file, owner, callback } of runAtOnce)
      if (
        !routines.has(callback) &&
        (routines.has(`${file}:${owner.node.start}`) || hostOf(routines, file, owner))
      ) {
        routines.add(callback);
        grew = true;
      }
  }
  const asyncRoutines = new Set();
  /** Callbacks an owned helper invokes directly, without storing or handing
   * them out. Their returned promises are values; the helper owns the await. */
  /** @type {Map<string, Path>} */ const functions = new Map();
  for (const [file, code] of files)
    traverseOwned(parseProgram(code, file), {
      Function(q) {
        functions.set(`${file}:${q.node.start}`, q);
      }
    });
  const invokedCallbacks = new Set();
  for (const [file, code] of files)
    traverseOwned(parseProgram(code, file), {
      CallExpression(q) {
        const target = report.call(file, q.node.start ?? 0, q.node.end ?? 0)?.target;
        const helper = target && functions.get(target);
        if (!helper || helper.node.generator) return;
        q.get("arguments").forEach((argument, i) => {
          if (!argument.isFunction() || argument.node.async || argument.node.generator) return;
          const parameter = helper.node.params[i];
          if (!t.isIdentifier(parameter)) return;
          const binding = helper.scope.getBinding(parameter.name);
          if (!binding?.constant || !binding.referencePaths.length) return;
          if (
            binding.referencePaths.every(ref => {
              if (!ref.parentPath?.isCallExpression() || ref.parentPath.node.callee !== ref.node)
                return false;
              let owner = ref.getFunctionParent();
              // The prelude puts try/catch/finally blocks in owned nativeTry
              // routines. They are control flow of the helper, not an escape.
              while (owner && owner !== helper) {
                const call = owner.parentPath;
                if (
                  !call?.isCallExpression() ||
                  !call.node.arguments.some(argument => argument === owner?.node)
                )
                  return false;
                const callee = call.get("callee");
                const spec = callee.isIdentifier()
                  ? callee.scope.getBinding(callee.node.name)?.path
                  : null;
                const api = imported(spec ?? undefined);
                if (api?.source !== "solid-yield/internal" || api.name !== "nativeTry")
                  return false;
                owner = call.getFunctionParent();
              }
              return owner === helper;
            })
          )
            invokedCallbacks.add(`${file}:${argument.node.start}`);
        });
      }
    });
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
    // A promise an async routine keeps as a value (`const request = fetch(url)`,
    // a receiver `fetch(url).text`, an argument) is a promise in the
    // original: attempting it would await it. Found by the call's authored
    // position, which a call lifted into the lowering's own routine keeps.
    const keptSites = new Set();
    traverseOwned(p, {
      "CallExpression|NewExpression"(q) {
        const fn = q.getFunctionParent();
        if (
          fn &&
          ((asyncRoutines.has(`${file}:${fn.node.start}`) &&
            !q.parentPath?.isAwaitExpression() &&
            !q.parentPath?.isExpressionStatement()) ||
            (invokedCallbacks.has(`${file}:${fn.node.start}`) &&
              (q.parentPath?.isReturnStatement() ||
                (fn.isArrowFunctionExpression() && fn.node.body === q.node))))
        )
          keptSites.add(`${q.node.start}:${q.node.end}`);
      }
    });
    /** What a kept promise bound by `const` may reject with, for its `await`. */
    const keptFailures = new Map();

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
    /** @param {any} value @param {string[]} kinds @param {import("@babel/core").types.TSTypeAnnotation | null} [returnType] */
    const attempt = (value, kinds, returnType = null, awaited = false) => {
      used.add("attempt");
      const thunk = t.arrowFunctionExpression(
        [],
        awaited ? t.blockStatement([t.returnStatement(value)]) : value
      );
      if (awaited && t.isBlockStatement(thunk.body))
        thunk.body.directives.push(t.directive(t.directiveLiteral(awaitDirective)));
      if (returnType) thunk.returnType = returnType;
      return t.callExpression(t.identifier("__nativeAttempt"), [thunk, handler(kinds)]);
    };
    /** A call the view evaluates in a JSX hole (`<p>{format(name())}</p>`): what
     * its attempt raises is the hole's failure, a failing read of the view.
     * @param {Path} at @param {any} node */
    const holed = (at, node) => {
      let up = at.parentPath;
      while (up && !up.isFunction() && !up.isJSXExpressionContainer()) up = up.parentPath;
      if (!up?.isJSXExpressionContainer()) return node;
      used.add("nativeHole");
      return t.callExpression(t.identifier("__nativeHole"), [node]);
    };
    /** `<For each={items()}>` with a call that returns a promise: Solid's `For`
     * takes the promise itself (and fails on it), so the model must not await
     * it. The attempt takes the value boxed: its synchronous failures, not its
     * waiting. @param {Path} at */
    const forEachPromise = at => {
      const attr = at.parentPath?.isJSXExpressionContainer() ? at.parentPath.parentPath : null;
      if (!attr?.isJSXAttribute() || !t.isJSXIdentifier(attr.node.name, { name: "each" }))
        return false;
      const tag = attr.parentPath?.isJSXOpeningElement() ? attr.parentPath.get("name") : null;
      const binding =
        tag && !Array.isArray(tag) && tag.isJSXIdentifier()
          ? tag.scope.getBinding(tag.node.name)?.path
          : undefined;
      const api = imported(binding);
      return api?.source === "solid-js" && api.name === "For";
    };
    /** @param {any} value @param {string[]} kinds @param {Path} [at] in a hole */
    const boxedAttempt = (value, kinds, at) => {
      const attempted = attempt(
        t.objectExpression([t.objectProperty(t.identifier("value"), value)]),
        kinds
      );
      return t.memberExpression(at ? holed(at, attempted) : attempted, t.identifier("value"));
    };
    /** A plain function's declared return type, for the attempt that wraps the
     * whole value it returns: the routine it becomes drops the annotation, and
     * the value (`new Promise(…)`) was typed from it. @param {Path} q */
    const declaredReturn = q => {
      const fn = q.getFunctionParent();
      const returned =
        q.parentPath?.isReturnStatement() ||
        (fn?.isArrowFunctionExpression() && fn.node.body === q.node);
      if (!returned || !fn || fn.node.async || fn.node.generator) return null;
      return t.isTSTypeAnnotation(fn.node.returnType)
        ? t.cloneNode(fn.node.returnType, true)
        : null;
    };
    /** @param {Path | null} fn */
    const host = fn => hostOf(routines, file, fn);
    /** The owned helper attempts this ordinary callback at its invocation.
     * Keep synchronous throws and returned promises there, not in a new
     * generator the plain callback contract cannot drive. @param {Path | null} fn */
    const plainInvokedCallback = fn =>
      !!fn &&
      invokedCallbacks.has(`${file}:${fn.node.start}`) &&
      !routines.has(`${file}:${fn.node.start}`);
    /** Every kept promise must reach an await or return through known value
     * flows. Storing it in an unused alias is as detached as dropping the call.
     * @param {Path} value @param {Path} owner @param {Set<import('@babel/core').types.Node>} seen
     * @returns {boolean} */
    const consumedPromise = (value, owner, seen) => {
      if (seen.has(value.node) || value.getFunctionParent() !== owner) return false;
      seen.add(value.node);
      const parent = value.parentPath;
      if (!parent) return false;
      if (
        (parent.isAwaitExpression() && parent.node.argument === value.node) ||
        (parent.isReturnStatement() && parent.node.argument === value.node) ||
        (parent.isArrowFunctionExpression() &&
          parent.node === owner.node &&
          parent.node.body === value.node)
      )
        return true;
      if (
        parent.isTSAsExpression() ||
        parent.isTSNonNullExpression() ||
        parent.isParenthesizedExpression()
      )
        return consumedPromise(parent, owner, seen);
      if (
        parent.isVariableDeclarator() &&
        parent.node.init === value.node &&
        t.isIdentifier(parent.node.id)
      ) {
        const binding = parent.scope.getBinding(parent.node.id.name);
        return (
          !!binding?.constant &&
          binding.referencePaths.length > 0 &&
          binding.referencePaths.every(ref => consumedPromise(ref, owner, new Set(seen)))
        );
      }
      if (
        parent.isMemberExpression() &&
        parent.node.object === value.node &&
        t.isIdentifier(parent.node.property) &&
        ["then", "catch", "finally"].includes(parent.node.property.name)
      ) {
        const call = parent.parentPath;
        return (
          !!call?.isCallExpression() &&
          call.node.callee === parent.node &&
          consumedPromise(call, owner, seen)
        );
      }
      const argument = parent.isArrayExpression() ? parent : value;
      const call = argument.parentPath;
      if (
        call?.isCallExpression() &&
        t.isMemberExpression(call.node.callee) &&
        t.isIdentifier(call.node.callee.object, { name: "Promise" }) &&
        !call.scope.getBinding("Promise") &&
        t.isIdentifier(call.node.callee.property) &&
        ["all", "allSettled", "race", "any", "resolve"].includes(call.node.callee.property.name) &&
        call.node.arguments[0] === argument.node
      )
        return consumedPromise(call, owner, seen);
      return false;
    };

    // Async reactive helpers run on their caller's host. Await becomes an
    // attempt at its original position; setup cannot admit that read/wait.
    traverseOwned(p, {
      "CallExpression|NewExpression"(q) {
        if (!q.isCallExpression() && !q.isNewExpression()) return;
        const info = report.call(file, q.node.start ?? 0, q.node.end ?? 0);
        const owner = q.getFunctionParent();
        const callee = /** @type {Path} */ (q.get("callee"));
        const api = callee.isIdentifier()
          ? imported(callee.scope.getBinding(callee.node.name)?.path)
          : null;
        if (
          owner &&
          asyncRoutines.has(`${file}:${owner.node.start}`) &&
          info?.promise &&
          q.parentPath?.isVariableDeclarator() &&
          // Async producer completion creates its own local and immediately
          // returns Promise.resolve(local). It is not an authored kept value.
          q.parentPath.node.start != null &&
          !consumedPromise(q, owner, new Set())
        )
          throw nativeRefusal(
            file,
            q.node,
            "NATIVE_DETACHED_PROMISE",
            "This kept promise has an unused or unknown use. Await or return it, or move detached work outside this reactive helper."
          );
        if (
          owner &&
          asyncRoutines.has(`${file}:${owner.node.start}`) &&
          info?.promise &&
          q.parentPath?.isExpressionStatement() &&
          !(api?.source === "solid-js" && api.name === "refresh") &&
          !(
            t.isMemberExpression(q.node.callee) &&
            t.isIdentifier(q.node.callee.property) &&
            ["then", "catch", "finally"].includes(q.node.callee.property.name)
          )
        )
          throw nativeRefusal(
            file,
            q.node,
            "NATIVE_DETACHED_PROMISE",
            "This promise is not awaited or returned. Await it, return it, or handle it outside this reactive helper."
          );
        if (
          info?.target &&
          asyncRoutines.has(info.target) &&
          owner &&
          report.at(file, owner.node.start ?? 0)?.component
        )
          throw nativeRefusal(
            file,
            q.node,
            "NATIVE_ASYNC_SETUP",
            "An async reactive read has setup as its host; call it from an event or memo."
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
        // An effect's phase returns its cleanup or nothing: an async one returns
        // a promise, which Solid refuses ("invalid cleanup value" in
        // development; in production it is called as the next cleanup).
        // Lowered as a routine, its promise would be gone and the check clean.
        if (
          api?.source === "solid-js" &&
          ["createEffect", "createRenderEffect"].includes(api.name) &&
          call.isCallExpression() &&
          call.node.arguments[1] === q.node
        )
          throw nativeRefusal(
            file,
            q.node,
            "SUGAR_ASYNC",
            "An effect's phase returns its cleanup; an async function returns a promise, which Solid refuses."
          );
        const kinds = [...(report.at(file, q.node.start ?? 0)?.fails ?? [])];
        if (q.isArrowFunctionExpression()) q.arrowFunctionToExpression();
        // Keep the authored async payload contract while its implementation
        // becomes a routine. `satisfies` retains literal discriminants and
        // checks bad results without asserting them away. A direct returned
        // promise remains a value until the caller settles it.
        const declared = t.isTSTypeAnnotation(q.node.returnType)
          ? q.node.returnType.typeAnnotation
          : null;
        const payload =
          t.isTSTypeReference(declared) &&
          t.isIdentifier(declared.typeName) &&
          ["Promise", "PromiseLike"].includes(declared.typeName.name) &&
          declared.typeParameters?.params.length === 1
            ? declared.typeParameters.params[0]
            : null;
        if (payload)
          q.traverse({
            Function(inner) {
              inner.skip();
            },
            ReturnStatement(returned) {
              if (!returned.node.argument) return;
              returned.node.argument = t.tsSatisfiesExpression(
                returned.node.argument,
                t.tsUnionType([
                  t.cloneNode(payload, true),
                  t.tsTypeReference(
                    t.identifier("PromiseLike"),
                    t.tsTypeParameterInstantiation([t.cloneNode(payload, true)])
                  )
                ])
              );
            }
          });
        q.node.async = false;
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
          const binding = t.isIdentifier(value) ? q.scope.getBinding(value.name) : undefined;
          // The child call's attempt already waits and carries its exact
          // failures. Wrapping it again would replace known empty failures
          // with unknown after its authored position has been rewritten.
          if (
            t.isCallExpression(value) &&
            t.isIdentifier(value.callee, { name: "__nativeAttempt" })
          ) {
            q.replaceWith(value);
            return;
          }
          q.replaceWith(
            attempt(
              value,
              info?.fails ?? keptFailures.get(binding?.path.node) ?? ["unknown"],
              null,
              true
            )
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
          if (
            t.isCallExpression(value) &&
            t.isIdentifier(value.callee, { name: "__nativeAttempt" })
          )
            q.replaceWith(value);
          else if (t.isCallExpression(value) || t.isNewExpression(value))
            q.replaceWith(attempt(value, ["unknown"]));
          else {
            // A value read here keeps its narrowing (`yield step.value` in a
            // `while (!step.done)` loop): a closure would read the reassigned
            // `let` unnarrowed. It is evaluated here and handed to the attempt.
            const held = q.scope.generateUidIdentifier("awaited");
            used.add("attempt");
            q.replaceWith(
              t.callExpression(t.identifier("__nativeAttempt"), [
                t.callExpression(
                  t.arrowFunctionExpression(
                    [held],
                    t.arrowFunctionExpression([], t.cloneNode(held))
                  ),
                  [value]
                ),
                handler(["unknown"])
              ])
            );
          }
        }
      },
      ThrowStatement(q) {
        const fn = q.getFunctionParent();
        if (plainInvokedCallback(fn)) return;
        if (!host(fn)) return;
        // F-S37: a context guard raises only what its value's narrowed type admits.
        const guard = report.guard(file, q.node.start ?? 0, q.node.end ?? 0);
        used.add(guard ? "nativeContextGuard" : "raise");
        if (fn) fn.node.returnType = null;
        const failure = adapt(
          report.throws(file, q.node.start ?? 0, q.node.end ?? 0),
          q.node.argument
        );
        const raised = copyPosition(
          guard
            ? t.callExpression(t.identifier("__nativeContextGuard"), [t.identifier(guard), failure])
            : t.callExpression(t.identifier("__nativeRaise"), [failure]),
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
          if (plainInvokedCallback(fn)) return;
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
          // A routine's stream returned from a memo (`return runEffect(…)`): the
          // memo takes it through an attempt (D-091), as it does a plain
          // function's. What its iterator raises is not inferred: `unknown`.
          if (
            info?.stream &&
            info.target &&
            routines.has(info.target) &&
            (q.parentPath?.isReturnStatement() ||
              (!!fn?.isArrowFunctionExpression() && fn.node.body === q.node))
          ) {
            const stream = q.scope.generateUidIdentifier("stream");
            q.replaceWith(
              t.callExpression(
                t.functionExpression(
                  null,
                  [],
                  t.blockStatement([
                    t.variableDeclaration("const", [
                      t.variableDeclarator(
                        stream,
                        /** @type {import("@babel/core").types.Expression} */ (q.node)
                      )
                    ]),
                    t.returnStatement(attempt(t.cloneNode(stream), ["unknown"]))
                  ]),
                  true
                ),
                []
              )
            );
            q.skip();
            return;
          }
          // A reactive Promise continuation keeps its lexical host (routines.js
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
          // A promise an async routine keeps as a value (`const data = load()`)
          // is a promise in the original: attempting it here would await it.
          // An async callee cannot throw synchronously, so the call stays plain;
          // the promise is attempted where the code awaits it.
          const keeps =
            !unawaited && info.promise && keptSites.has(`${q.node.start}:${q.node.end}`);
          // An async callee cannot throw synchronously, nor can the platform's
          // (WebIDL turns its exceptions into rejections): the call stays
          // plain. Another may throw before it returns its promise: the
          // attempt takes the value boxed, its synchronous failures, not its
          // waiting.
          const kept = keeps && (info.async || info.platform);
          const keptBoxed = keeps && !kept;
          const declarator = q.parentPath?.isVariableDeclarator() ? q.parentPath : null;
          if (keeps && t.isVariableDeclaration(declarator?.parentPath?.node, { kind: "const" }))
            keptFailures.set(declarator.node, info.fails);
          /** @type {{id: import("@babel/core").types.Identifier, kinds: Set<string>} | undefined} */
          let pending;
          // A chain that cannot fail has nothing for its host to take: it
          // runs on after the host, as in Solid, and is not waited for.
          if (unawaited && fn && kinds.length) {
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
              if (flowRow(binding)) return true;
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
                // an await lowered already (`(await fetch(url)).text()`)
                if (value.get("callee").isIdentifier({ name: "__nativeAttempt" }))
                  readsArgument = true;
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
            // an await in it (`(await fetch(url)).text()`) is an attempt by now
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
            statements.push(
              t.returnStatement(
                unawaited || kept
                  ? value
                  : info.promise && (keptBoxed || forEachPromise(q))
                    ? boxedAttempt(value, kinds)
                    : attempt(value, kinds)
              )
            );
            q.replaceWith(
              holed(
                q,
                t.callExpression(
                  t.functionExpression(null, [], t.blockStatement(statements), true),
                  []
                )
              )
            );
          } else if (!unawaited && !kept) {
            const boxed = !!info?.promise && (keptBoxed || forEachPromise(q));
            const attempted = boxed
              ? boxedAttempt(call, kinds, q)
              : attempt(call, kinds, declaredReturn(q));
            const subject = call.arguments[0];
            // A type guard's narrowing survives its attempt (`if
            // (Exit.isSuccess(exit)) … exit.value`): the attempted result is
            // handed to a guard of the same type.
            if (info.predicate === 0 && t.isIdentifier(subject) && t.isExpression(call.callee)) {
              used.add("nativeGuarded");
              q.replaceWith(
                t.callExpression(t.identifier("__nativeGuarded"), [
                  t.cloneNode(subject),
                  holed(q, attempted),
                  t.cloneNode(call.callee, true)
                ])
              );
            } else q.replaceWith(boxed ? attempted : holed(q, attempted));
          }
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
        // A projection's draft (any parameter) is the compute's; the producer,
        // now the attempt's thunk, closes over it.
        const params = callback.node.params;
        callback.node.params = [];
        callback.replaceWith(
          t.arrowFunctionExpression(
            params,
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
      nativeInvoke: "__nativeInvoke",
      nativeGuarded: "__nativeGuarded",
      nativeHole: "__nativeHole",
      nativeContextGuard: "__nativeContextGuard"
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
          throw nativeRefusal(
            file,
            binding.path.node,
            "NATIVE_NAME",
            `Reserve ${aliases[name]} for the generated native import.`
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
