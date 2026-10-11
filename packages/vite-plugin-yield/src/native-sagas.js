// @ts-check
// D-121: a generator handed to a function that calls it only inside an
// `action` (Effect's `effectAction(function* () {…})`, whose driver steps it
// with `next`/`throw`). Its `yield*` belongs to that driver, so its writes
// cannot be delegated; they run inside the action that drives it, so the model
// performs them where they are made, as the original does.
import babel from "@babel/core";
import ts from "typescript";
import { parseProgram } from "./transform.js";
import { printMapped } from "./positions.js";
import { authoredOpaqueGenerator } from "./native-owned.js";

const t = babel.types;
/** @typedef {import("@babel/core").NodePath<any>} Path */
const stateCreators = new Set([
  "createSignal",
  "createStore",
  "createOptimistic",
  "createOptimisticStore"
]);

/** The Solid API an identifier is imported as, if it is one.
 * @param {Path} id */
function solidName(id) {
  const spec = id.scope.getBinding(id.node.name)?.path;
  if (
    !spec?.isImportSpecifier() ||
    !spec.parentPath?.isImportDeclaration() ||
    spec.parentPath.node.source.value !== "solid-js"
  )
    return null;
  return t.isIdentifier(spec.node.imported) ? spec.node.imported.name : spec.node.imported.value;
}

/** A setter: the second element of `const [v, set] = createSignal(…)` (or a store's).
 * @param {Path} id */
function setter(id) {
  const binding = id.scope.getBinding(id.node.name);
  const declarator = binding?.path;
  if (!declarator?.isVariableDeclarator() || !t.isArrayPattern(declarator.node.id)) return false;
  if (declarator.node.id.elements[1] !== binding?.identifier) return false;
  const init = declarator.get("init");
  return (
    !Array.isArray(init) &&
    init.isCallExpression() &&
    init.get("callee").isIdentifier() &&
    stateCreators.has(solidName(init.get("callee")) ?? "")
  );
}

/** Whether a function is the generator given to Solid's `action`.
 * @param {ts.Node} fn @param {ts.TypeChecker} checker */
function actionGenerator(fn, checker) {
  if (!ts.isFunctionExpression(fn) || !fn.asteriskToken) return false;
  const call = fn.parent;
  if (!ts.isCallExpression(call) || call.arguments[0] !== fn || !ts.isIdentifier(call.expression))
    return false;
  const declaration = checker.getSymbolAtLocation(call.expression)?.declarations?.[0];
  if (!declaration || !ts.isImportSpecifier(declaration)) return false;
  const module = declaration.parent.parent.parent.moduleSpecifier;
  return (
    (declaration.propertyName ?? declaration.name).text === "action" &&
    ts.isStringLiteral(module) &&
    module.text === "solid-js"
  );
}

/** Whether every use of `param` in `fn` calls it directly in an `action`'s generator.
 * @param {ts.FunctionLikeDeclaration} fn @param {ts.ParameterDeclaration} param
 * @param {ts.TypeChecker} checker */
function drivenInAction(fn, param, checker) {
  const symbol = checker.getSymbolAtLocation(param.name);
  if (!symbol || !fn.body) return false;
  let uses = 0;
  let inside = true;
  /** @param {ts.Node} n */
  const visit = n => {
    if (ts.isIdentifier(n) && n !== param.name && checker.getSymbolAtLocation(n) === symbol) {
      uses++;
      /** @type {ts.Node | undefined} */ let host = n.parent;
      while (host && !ts.isFunctionLike(host)) host = host.parent;
      inside &&=
        ts.isCallExpression(n.parent) &&
        n.parent.expression === n &&
        !!host &&
        actionGenerator(host, checker);
    }
    ts.forEachChild(n, visit);
  };
  visit(fn.body);
  return inside && uses > 0;
}

/** The function a call's callee names, through imports.
 * @param {ts.CallExpression} call @param {ts.TypeChecker} checker */
function calleeFunction(call, checker) {
  let symbol = checker.getSymbolAtLocation(call.expression);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  const declaration = symbol?.valueDeclaration ?? symbol?.declarations?.[0];
  if (!declaration) return null;
  if (ts.isFunctionDeclaration(declaration)) return declaration;
  if (
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer &&
    (ts.isArrowFunction(declaration.initializer) ||
      ts.isFunctionExpression(declaration.initializer))
  )
    return declaration.initializer;
  return null;
}

/** @param {ts.SourceFile} source @param {number} start */
function callAt(source, start) {
  /** @type {ts.CallExpression | null} */ let found = null;
  /** @param {ts.Node} n */
  const visit = n => {
    if (found || n.end <= start || n.pos > start) return;
    if (ts.isCallExpression(n) && n.getStart(source) === start) found = n;
    else ts.forEachChild(n, visit);
  };
  visit(source);
  return /** @type {ts.CallExpression | null} */ (found);
}

/**
 * @param {Map<string, string>} files authored native files
 * @param {() => ts.Program} programFor the source program, built only when needed
 */
export function lowerDrivenSagas(files, programFor) {
  /** @type {{ file: string, p: Path, saga: Path, call: Path, index: number }[]} */
  const candidates = [];
  /** @type {Map<string, Path>} */ const programs = new Map();
  for (const [file, code] of files) {
    if (!/function\s*\*/.test(code)) continue;
    const p = parseProgram(code, file);
    if (!p) continue;
    programs.set(file, p);
    p.traverse({
      FunctionExpression(q) {
        if (!q.node.generator || !authoredOpaqueGenerator(q) || q.listKey !== "arguments") return;
        const call = q.parentPath;
        if (call?.isCallExpression())
          candidates.push({ file, p, saga: q, call, index: /** @type {number} */ (q.key) });
      }
    });
  }
  if (!candidates.length) return files;
  const program = programFor();
  const checker = program.getTypeChecker();
  /** @type {Set<Path>} */ const changed = new Set();
  for (const { file, p, saga, call, index } of candidates) {
    const source = program.getSourceFile(file);
    const node = source && callAt(source, /** @type {number} */ (call.node.start));
    const fn = node && calleeFunction(node, checker);
    const param = fn?.parameters[index];
    if (!fn || !param || !ts.isIdentifier(param.name) || param.dotDotDotToken) continue;
    if (!drivenInAction(fn, param, checker)) continue;
    saga.traverse({
      Function(inner) {
        inner.skip(); // a nested callback may run outside the action
      },
      CallExpression(c) {
        const callee = c.get("callee");
        if (!callee.isIdentifier()) return;
        if (solidName(callee) === "refresh") {
          c.node.callee = t.callExpression(t.identifier("__nativeWrite"), [
            t.identifier("__nativeRefresh")
          ]);
          p.setData("nativeRefresh", true);
        } else if (setter(callee))
          c.node.callee = t.callExpression(t.identifier("__nativeWrite"), [callee.node]);
        else return;
        changed.add(p);
      }
    });
  }
  if (!changed.size) return files;
  const out = new Map(files);
  for (const [file, p] of programs) {
    if (!changed.has(p)) continue;
    p.node.body.unshift(
      t.importDeclaration(
        [t.importSpecifier(t.identifier("__nativeWrite"), t.identifier("nativeWrite"))],
        t.stringLiteral("solid-yield/internal")
      )
    );
    if (p.getData("nativeRefresh"))
      p.node.body.unshift(
        t.importDeclaration(
          [t.importSpecifier(t.identifier("__nativeRefresh"), t.identifier("refresh"))],
          t.stringLiteral("solid-yield")
        )
      );
    out.set(file, printMapped(t.file(p.node)));
  }
  return out;
}
