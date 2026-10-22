// @ts-check
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { dirname, resolve, isAbsolute, relative } from "node:path";
import { parseSync } from "oxc-parser";
import { ResolverFactory } from "oxc-resolver";

export const installedPath = path => /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(path);
const declarationPath = path => /[.]d[.](?:ts|mts|cts)$/.test(path);

export const plain = value => ({ tag: "plain", value });
export const unknown = (reason = "no body or annotation") => ({ tag: "unknown", reason });
export const object = (members = new Map()) => ({ tag: "object", members });
export function scalarKey(value) {
  if (
    value?.tag !== "plain" ||
    !Object.values(value).every(
      v => v === null || ["undefined", "boolean", "number", "string", "bigint"].includes(typeof v)
    )
  )
    return null;
  return JSON.stringify(
    Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, v]) => [
        key,
        typeof v,
        typeof v === "number" || typeof v === "bigint" ? (Object.is(v, -0) ? "-0" : String(v)) : v
      ])
  );
}
export function join(...values) {
  const arms = values.flatMap(v => (v?.tag === "union" ? v.arms : v ? [v] : []));
  const seen = new Set();
  const unique = arms.filter(value => {
    // Equal scalar facts are one alternative, not a fresh branch on each join.
    // Mutable values still compare by identity (two factories remain distinct).
    const scalar = scalarKey(value);
    const key = scalar === null ? value : "plain:" + scalar;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.length === 1 ? unique[0] : unique.length ? { tag: "union", arms: unique } : plain();
}
export function each(value, fn) {
  return value?.tag === "union" ? join(...value.arms.map(fn)) : fn(value ?? plain());
}
export class Env {
  constructor(parent = null, module = null) {
    this.parent = parent;
    this.module = module ?? parent?.module;
    this.cells = new Map();
  }
  define(name, value, node) {
    this.cells.set(name, { value, node, env: this });
  }
  cell(name) {
    return this.cells.get(name) ?? this.parent?.cell(name);
  }
  get(name) {
    return this.cell(name)?.value;
  }
}

const globals = new Set([
  "Math",
  "JSON",
  "Promise",
  "console",
  "document",
  "window",
  "globalThis",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "Date",
  "RegExp",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Error",
  "RangeError",
  "TypeError",
  "SyntaxError",
  "ReferenceError",
  "URL",
  "URLSearchParams",
  "AbortController",
  "Intl",
  "Reflect",
  "Symbol",
  "BigInt",
  "fetch",
  "setTimeout",
  "setInterval",
  "queueMicrotask",
  "requestAnimationFrame",
  "clearTimeout",
  "clearInterval",
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
  "encodeURIComponent",
  "decodeURIComponent"
]);
export const globalValue = name =>
  globals.has(name)
    ? { tag: "platform", path: name }
    : name === "undefined"
      ? { ...plain(), undefinedValue: true }
      : name === "NaN"
        ? plain(NaN)
        : unknown("unresolved name " + name);
export function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const [key, child] of Object.entries(node)) {
    if (key === "type" || key === "parent") continue;
    if (Array.isArray(child)) child.forEach(n => walk(n, visit));
    else if (child && typeof child === "object") walk(child, visit);
  }
}
export function keyName(node) {
  return node?.name ?? node?.value ?? "";
}
export function unwrap(node) {
  while (
    node &&
    [
      "TSAsExpression",
      "TSTypeAssertion",
      "TSNonNullExpression",
      "ParenthesizedExpression",
      "ChainExpression",
      "TSSatisfiesExpression",
      "TSInstantiationExpression"
    ].includes(node.type)
  )
    node = node.expression;
  return node;
}
export class Modules {
  constructor(options) {
    this.options = options;
    this.modules = new Map();
    this.dependencies = new Set();
    this.resolutions = new Map();
    this.packages = new Map();
    this.dependencyCache = new Map();
    this.dependencyRoots = new Set();
    this.locations = new WeakMap();
    this.locationCache = new WeakMap();
    this.resolver = new ResolverFactory({
      extensions: [".ts", ".tsx", ".mts", ".js", ".mjs", ".jsx", ".d.ts"],
      conditionNames: ["types", "import", "browser", "default"],
      mainFields: ["types", "module", "main"],
      extensionAlias: { ".js": [".ts", ".tsx", ".js"], ".mjs": [".mts", ".mjs"] }
    });
  }
  text(path) {
    try {
      return this.options.readFile?.(path) ?? readFileSync(path, "utf8");
    } catch {
      return undefined;
    }
  }
  resolve(from, spec) {
    const directory = dirname(from);
    const cacheKey = directory + ":" + spec;
    if (!this.resolutions.has(cacheKey))
      this.resolutions.set(cacheKey, this.resolver.sync(directory, spec));
    const result = this.resolutions.get(cacheKey);
    if (result.path) {
      let pkg;
      if (result.packageJsonPath) {
        try {
          if (!this.packages.has(result.packageJsonPath))
            this.packages.set(
              result.packageJsonPath,
              JSON.parse(readFileSync(result.packageJsonPath, "utf8")).name
            );
          pkg = this.packages.get(result.packageJsonPath);
        } catch {}
      }
      const dependency =
        this.isDependency(from) ||
        installedPath(result.path) ||
        (!spec.startsWith(".") && !isAbsolute(spec));
      if (dependency) {
        this.dependencies.add(result.path);
        if (result.packageJsonPath) {
          const previousSize = this.dependencyRoots.size;
          this.dependencyRoots.add(dirname(result.packageJsonPath));
          try {
            this.dependencyRoots.add(dirname(realpathSync(result.packageJsonPath)));
          } catch {}
          if (previousSize !== this.dependencyRoots.size) this.dependencyCache.clear();
        }
      }
      // An implementation entry may have an adjacent declaration even without
      // a package-level types field. Never use that implementation as a fallback.
      const sidecar =
        dependency && !declarationPath(result.path)
          ? result.path.replace(
              /[.](?:[cm]?js|tsx?|jsx)$/,
              result.path.endsWith(".mjs")
                ? ".d.mts"
                : result.path.endsWith(".cjs")
                  ? ".d.cts"
                  : ".d.ts"
            )
          : null;
      if (sidecar && sidecar !== result.path && existsSync(sidecar)) {
        this.dependencies.add(sidecar);
        return { ...result, path: sidecar, pkg, dependency };
      }
      return { ...result, pkg, dependency };
    }
    if (spec.startsWith("."))
      for (const ext of ["", ".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"]) {
        const path = resolve(dirname(from), spec + ext);
        if (existsSync(path) || this.options.files.includes(path)) return { path };
      }
    return result;
  }
  isDependency(path) {
    if (installedPath(path) || this.dependencies.has(path)) return true;
    if (this.dependencyCache.has(path)) return this.dependencyCache.get(path);
    const result =
      installedPath(path) ||
      this.dependencies.has(path) ||
      [...this.dependencyRoots].some(root => {
        const subpath = relative(root, path);
        return !subpath.startsWith("..") && !isAbsolute(subpath);
      });
    this.dependencyCache.set(path, result);
    return result;
  }
  prepare() {
    const visited = new Set();
    const visit = path => {
      if (!path || visited.has(path) || this.isDependency(path)) return;
      visited.add(path);
      const mod = this.load(path);
      for (const link of [...mod.imported.values(), ...mod.exports.values()]) visit(link.path);
    };
    // Resolve application imports before considering over-inclusive linked roots.
    for (const path of this.options.files)
      if (!relative(this.options.rootDir, path).startsWith("..")) visit(path);
    for (const path of this.options.files) visit(path);
    // An edit can establish a new installed-package boundary around an old root.
    for (const [path, mod] of this.modules)
      if (!mod.dependency && this.isDependency(path)) {
        this.modules.delete(path);
        this.load(path);
      }
  }
  load(path) {
    if (this.modules.has(path)) return this.modules.get(path);
    // Installed bodies are not even parsed, including over-inclusive roots.
    const dependency = this.isDependency(path);
    const blocked = dependency && !declarationPath(path);
    const text = blocked ? "" : (this.text(path) ?? "");
    const parsed = parseSync(path, text, { sourceType: "module" });
    const mod = {
      path,
      text,
      lineStarts: [0, ...Array.from(text.matchAll(/\n/g), m => m.index + 1)],
      dependency,
      blocked,
      declarationOnly: blocked || declarationPath(path),
      ast: parsed.program,
      errors: parsed.errors,
      exports: new Map(),
      types: new Map(),
      state: "new",
      imported: new Map()
    };
    mod.env = new Env(null, mod);
    this.modules.set(path, mod);
    walk(mod.ast, node => this.locations.set(node, mod));
    for (const statement of mod.ast.body) {
      const n = statement.declaration ?? statement;
      if (n.type === "TSTypeAliasDeclaration" || n.type === "TSInterfaceDeclaration")
        mod.types.set(n.id.name, n);
      if (statement.type === "ImportDeclaration") {
        const resolution = this.resolve(path, statement.source.value);
        const pkg = resolution.pkg;
        for (const s of statement.specifiers) {
          const imported =
            s.type === "ImportNamespaceSpecifier"
              ? "*"
              : s.type === "ImportDefaultSpecifier"
                ? "default"
                : keyName(s.imported);
          const link = {
            tag: "link",
            path: resolution.path,
            dependency: resolution.dependency,
            name: imported,
            pkg,
            spec: statement.source.value
          };
          mod.env.define(s.local.name, link, s);
          mod.imported.set(s.local.name, link);
        }
      }
      if (statement.type === "ExportNamedDeclaration") {
        if (n.id?.name) mod.exports.set(n.id.name, { local: n.id.name });
        for (const d of n.declarations ?? [])
          if (d.id.type === "Identifier") mod.exports.set(d.id.name, { local: d.id.name });
        for (const s of statement.specifiers ?? [])
          mod.exports.set(
            keyName(s.exported),
            statement.source
              ? { ...this.resolve(path, statement.source.value), name: keyName(s.local) }
              : { local: keyName(s.local) }
          );
      }
      if (statement.type === "ExportDefaultDeclaration")
        mod.exports.set("default", { declaration: n });
      if (statement.type === "ExportAllDeclaration")
        mod.exports.set("*" + statement.start, {
          ...this.resolve(path, statement.source.value),
          name: "*"
        });
    }
    return mod;
  }
  loc(node) {
    const mod = this.locations.get(node);
    if (!mod) return { file: this.options.files[0], line: 1, col: 1 };
    if (this.locationCache.has(node)) return this.locationCache.get(node);
    const position = offset => {
      let lo = 0,
        hi = mod.lineStarts.length;
      while (lo + 1 < hi) {
        const mid = (lo + hi) >>> 1;
        if (mod.lineStarts[mid] <= offset) lo = mid;
        else hi = mid;
      }
      return { line: lo + 1, col: offset - mod.lineStarts[lo] + 1 };
    };
    const start = position(node.start);
    const end = position(node.end);
    const loc = { file: mod.path, ...start, endLine: end.line, endCol: end.col };
    this.locationCache.set(node, loc);
    return loc;
  }
  shape(node, env, seen = new Set()) {
    if (!node) return unknown("missing annotation");
    if (node.type === "TSTypeAnnotation") return this.shape(node.typeAnnotation, env, seen);
    if (node.type === "TSParenthesizedType" || node.type === "TSOptionalType")
      return this.shape(node.typeAnnotation, env, seen);
    if (node.type === "TSUnionType" || node.type === "TSIntersectionType")
      return join(...node.types.map(n => this.shape(n, env, seen)));
    if (node.type === "TSUndefinedKeyword") return { ...plain(), undefinedValue: true };
    if (node.type === "TSNullKeyword") return plain(null);
    if (node.type === "TSVoidKeyword") return plain();
    if (node.type === "TSStringKeyword") return { tag: "platformInstance", path: "String" };
    if (
      ["TSNumberKeyword", "TSBooleanKeyword", "TSNeverKeyword", "TSLiteralType"].includes(node.type)
    )
      return plain();
    if (node.type === "TSArrayType" || node.type === "TSTupleType")
      return { tag: "array", elements: [this.shape(node.elementType, env, seen)] };
    if (
      node.type === "TSFunctionType" ||
      node.type === "TSMethodSignature" ||
      node.type === "TSCallSignatureDeclaration" ||
      node.type === "TSDeclareFunction" ||
      node.type === "FunctionDeclaration"
    )
      return {
        tag: "declared",
        result: this.shape(node.returnType ?? node.typeAnnotation, env, seen),
        node
      };
    if (node.type === "TSTypeLiteral" || node.type === "TSInterfaceBody") {
      const members = new Map();
      for (const member of node.members ?? node.body ?? []) {
        const key = keyName(member.key);
        if (key) {
          const shape =
            member.type === "TSMethodSignature"
              ? this.shape(member, env, seen)
              : this.shape(member.typeAnnotation, env, seen);
          members.set(key, shape);
        }
      }
      return object(members);
    }
    if (node.type === "TSTypeOperator") return this.shape(node.typeAnnotation, env, seen);
    if (node.type === "TSTypeReference") {
      const name = keyName(node.typeName);
      const args = node.typeArguments?.params ?? [];
      if (name === "Promise" || name === "PromiseLike")
        return { tag: "promise", rejects: ["unknown"], result: this.shape(args[0], env, seen) };
      if (name === "Accessor") return { tag: "declared", result: this.shape(args[0], env, seen) };
      if (name === "Array" || name === "ReadonlyArray")
        return { tag: "array", elements: [this.shape(args[0], env, seen)] };
      if (seen.has(name)) return unknown("recursive annotation");
      const next = new Set([...seen, name]);
      let mod = env.module;
      let type = mod.types.get(name);
      const link = mod.imported.get(name);
      if (!type && link?.path) {
        mod = this.load(link.path);
        type = mod.types.get(link.name);
      }
      if (type) return this.shape(type.typeAnnotation ?? type.body, mod.env, next);
      if (["Event", "MouseEvent", "InputEvent", "SubmitEvent", "KeyboardEvent"].includes(name))
        return { tag: "platformInstance", path: "Event" };
      if (name.startsWith("HTML") && name.endsWith("Element"))
        return { tag: "platformInstance", path: "Element" };
      return unknown("annotation needs inference: " + name);
    }
    return unknown("annotation needs inference: " + node.type);
  }
}
