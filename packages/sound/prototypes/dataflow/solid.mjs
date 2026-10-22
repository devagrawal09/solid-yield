// @ts-check
// Recognition of Solid 2 (rc.17) APIs and platform contracts, via the type
// checker's symbols: "which import is this" is answered by where the
// declaration lives, never by the local name alone.
import ts from "typescript";

/** Timer-like platform functions whose callback runs detached (handler-like). */
export const DETACHED_CALLBACKS = new Set(["setTimeout", "setInterval", "queueMicrotask", "requestAnimationFrame", "requestIdleCallback"]);
/** Array / string / Map / Set methods whose callback runs synchronously in the caller's scope. */
export const SYNC_CALLBACK_METHODS = new Set(["map", "filter", "reduce", "reduceRight", "forEach", "some", "every", "find", "findIndex", "findLast", "findLastIndex", "flatMap", "sort", "toSorted", "replace", "replaceAll"]);
/** Promise instance methods with chain semantics. */
export const PROMISE_METHODS = new Set(["then", "catch", "finally"]);
/** Platform calls that never fail and are not reads. */
export const SAFE_PLATFORM = new Set(["preventDefault", "stopPropagation", "stopImmediatePropagation", "removeEventListener", "log", "warn", "error", "info", "debug", "trace", "toFixed", "toString", "trim", "toLowerCase", "toUpperCase", "includes", "join", "slice", "split", "concat", "push", "pop", "shift", "unshift", "indexOf", "lastIndexOf", "startsWith", "endsWith", "padStart", "padEnd", "at", "keys", "values", "entries", "has", "get", "set", "add", "delete", "clear", "floor", "ceil", "round", "max", "min", "abs", "random", "now", "stringify", "isArray", "from", "assign", "freeze", "charAt", "charCodeAt", "repeat", "localeCompare", "getTime", "toISOString", "focus", "blur", "click", "select", "scrollIntoView"]);
/** Platform calls with a known failure type (synchronous throw). */
export const PLATFORM_THROWS = new Map([["parse", "SyntaxError"]]);

/**
 * @param {ts.Symbol | undefined} symbol
 * @param {ts.TypeChecker} checker
 */
export function resolveAlias(symbol, checker) {
  if (!symbol) return undefined;
  // A type-only import can share its name/symbol with a local runtime value.
  // Resolving that symbol as an import loses the local function declaration.
  if (!(symbol.flags & ts.SymbolFlags.Alias) || (symbol.flags & ts.SymbolFlags.Value)) return symbol;
  const target = checker.getAliasedSymbol(symbol);
  // Failed aliases share TypeScript's synthetic unknown symbol. It is not an
  // identity to which we can attach application bindings or component facts.
  return target.declarations?.length ? target : undefined;
}

/**
 * The npm package a declaration lives in ("solid-js", "@solidjs/web", "@solidjs/signals"), or null for project / lib files.
 * @param {ts.Declaration | undefined} declaration
 */
export function packageOf(declaration) {
  if (!declaration) return null;
  const file = declaration.getSourceFile().fileName.replaceAll("\\", "/");
  const m = file.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//g);
  if (!m) return null;
  const last = m[m.length - 1];
  return last.slice("node_modules/".length, -1);
}

/** @param {string | null} pkg */
export function isSolidPackage(pkg) {
  return pkg === "solid-js" || pkg === "@solidjs/signals" || pkg === "@solidjs/web";
}

/**
 * Names the Solid export an identifier refers to, if any (through aliases and re-exports).
 * @param {ts.Node} node
 * @param {ts.TypeChecker} checker
 * @returns {{ api: string, pkg: string } | null}
 */
export function solidApiOf(node, checker) {
  let cache = apiCaches.get(checker);
  if (!cache) apiCaches.set(checker, cache = new WeakMap());
  if (cache.has(node)) return cache.get(node);
  const result = lookupSolidApi(node, checker);
  cache.set(node, result);
  return result;
}

/** @type {WeakMap<ts.TypeChecker, WeakMap<ts.Node, { api: string, pkg: string } | null>>} */
const apiCaches = new WeakMap();
/** @param {ts.Node} node @param {ts.TypeChecker} checker */
function lookupSolidApi(node, checker) {
  const symbol = resolveAlias(checker.getSymbolAtLocation(node), checker);
  const declaration = symbol?.declarations?.[0];
  const pkg = packageOf(declaration);
  if (!isSolidPackage(pkg) || !symbol) return null;
  return { api: symbol.name, pkg: pkg ?? "" };
}

/** JSX attribute names that bind event handlers (Solid: on*, on:*, oncapture:*). @param {string} name */
export function isEventAttribute(name) {
  return /^on(?:[A-Z]|:|capture:)/.test(name);
}

/**
 * @param {ts.Type} type
 * @param {ts.TypeChecker} checker
 */
export function isPromiseType(type, checker) {
  // TypeScript exposes this oracle at runtime (including PromiseLike); keep
  // its internal signature local rather than matching a printed type name.
  const oracle = /** @type {ts.TypeChecker & { getPromisedTypeOfPromise(type: ts.Type): ts.Type | undefined }} */ (checker);
  if (oracle.getPromisedTypeOfPromise(type)) return true;
  if (type.isUnion()) return type.types.some(t => oracle.getPromisedTypeOfPromise(t) !== undefined);
  return false;
}

/**
 * @param {ts.Type} type
 * @param {ts.TypeChecker} checker
 */
export function isFunctionType(type, checker) {
  const parts = type.isUnion() ? type.types : [type];
  return parts.some(t => checker.getSignaturesOfType(t, ts.SignatureKind.Call).length > 0);
}

/** @param {ts.Expression} e */
export function stripParens(e) {
  let node = e;
  while (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node) || ts.isTypeAssertionExpression(node)) node = node.expression;
  return node;
}

/** @param {ts.Node} node */
export function isFunctionLike(node) {
  return ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node);
}
