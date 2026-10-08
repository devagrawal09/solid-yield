import { printMapped } from "./positions.js";
// @ts-check
import babel from "@babel/core";
import { parseProgram } from "./transform.js";
const t = babel.types;
/** @typedef {import('@babel/core').NodePath<any>} Path */
/** @typedef {{pending:boolean, fails:Set<string>}} Color */
/** @returns {Color} */
const empty = () => ({ pending: false, fails: new Set() });
/** @param {Color} into @param {Color} from */
function merge(into, from) {
  into.pending ||= from.pending;
  for (const kind of from.fails) into.fails.add(kind);
}
/** Reconstruct the numeric prop/early-return surface of self-recursive native
 * components. This pass never admits a read in setup: aliases are paths, pure
 * arithmetic is substituted at its use, and branch setup runs in a Match row.
 * @param {string} code @param {string} file */
export function lowerNativeRecursion(code, file) {
  const p = parseProgram(code, file);
  if (!p) return code;
  /** @type {Map<string, {path:Path, param:string, props:any, incoming:Map<string,Color>, memos:Map<string,any>, output:Color}>} */
  const components = new Map();
  let recursive = false;
  p.traverse({
    Function(q) {
      if (q.getFunctionParent()) return;
      const name =
        q.parentPath.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id)
          ? q.parentPath.node.id.name
          : "id" in q.node
            ? q.node.id?.name
            : "";
      if (!name || !/^[A-Z]/.test(name)) return;
      let jsx = false;
      q.traverse({
        Function(r) {
          r.skip();
        },
        JSXElement() {
          jsx = true;
        },
        JSXFragment() {
          jsx = true;
        }
      });
      if (!jsx) return;
      const param = q.node.params[0];
      const info = {
        path: q,
        param: t.isIdentifier(param) ? param.name : "",
        props:
          t.isIdentifier(param) && param.typeAnnotation?.type === "TSTypeAnnotation"
            ? param.typeAnnotation.typeAnnotation
            : undefined,
        incoming: new Map(),
        memos: new Map(),
        output: empty()
      };
      components.set(name, info);
      q.traverse({
        JSXOpeningElement(r) {
          if (t.isJSXIdentifier(r.node.name, { name })) recursive = true;
        },
        VariableDeclarator(r) {
          const init = r.get("init");
          if (!t.isIdentifier(r.node.id) || !init.isCallExpression()) return;
          const callee = init.get("callee"),
            binding = callee.isIdentifier()
              ? callee.scope.getBinding(callee.node.name)?.path
              : null;
          if (
            binding?.isImportSpecifier() &&
            binding.parentPath.isImportDeclaration() &&
            t.isIdentifier(binding.node.imported, { name: "createMemo" }) &&
            binding.parentPath.node.source.value === "solid-js"
          )
            info.memos.set(r.node.id.name, init.node.arguments[0]);
        }
      });
    }
  });
  // Keep the existing front end for components without this reconstruction need.
  if (!recursive) return code;
  // Replacing a one-time snapshot with a path is valid only for fixed numeric
  // positions. Prove that every selected JSX caller supplies such positions,
  // including the recursive edges; never extend this to changing props.
  /** @type {Map<string, Map<string,string>>} */ const snapshots = new Map();
  /** @type {Map<string, Set<string>>} */ const fixed = new Map();
  for (const [name, info] of components) {
    const aliases = new Map();
    info.path.traverse({
      VariableDeclarator(q) {
        if (
          q.getFunctionParent() !== info.path ||
          !t.isObjectPattern(q.node.id) ||
          !t.isIdentifier(q.node.init, { name: info.param })
        )
          return;
        for (const prop of q.node.id.properties)
          if (
            t.isObjectProperty(prop) &&
            !prop.computed &&
            t.isIdentifier(prop.key) &&
            t.isIdentifier(prop.value)
          )
            aliases.set(prop.value.name, prop.key.name);
      }
    });
    snapshots.set(name, aliases);
    fixed.set(name, new Set(aliases.values()));
    const declaration = info.path.parentPath;
    if (declaration?.parentPath?.parentPath?.isExportNamedDeclaration()) fixed.get(name)?.clear();
  }
  /** @param {any} n @param {string} owner @param {Set<string>} [seen] @returns {boolean} */
  const numeric = (n, owner, seen = new Set()) => {
    if (t.isNumericLiteral(n)) return true;
    if (t.isUnaryExpression(n) && ["+", "-"].includes(n.operator))
      return numeric(n.argument, owner, seen);
    if (t.isBinaryExpression(n) && ["+", "-", "*", "/", "%"].includes(n.operator))
      return numeric(n.left, owner, seen) && numeric(n.right, owner, seen);
    const info = components.get(owner);
    if (
      t.isMemberExpression(n) &&
      t.isIdentifier(n.object, { name: info?.param }) &&
      t.isIdentifier(n.property)
    )
      return !!fixed.get(owner)?.has(n.property.name);
    if (!t.isIdentifier(n)) return false;
    const alias = snapshots.get(owner)?.get(n.name);
    if (alias) return !!fixed.get(owner)?.has(alias);
    if (seen.has(n.name)) return false;
    const binding = info?.path.scope.getBinding(n.name);
    if (!binding?.constant || !binding.path.isVariableDeclarator()) return false;
    return numeric(binding.path.node.init, owner, new Set([...seen, n.name]));
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (const [name, info] of components)
      info.path.traverse({
        JSXOpeningElement(q) {
          if (!t.isJSXIdentifier(q.node.name)) return;
          const fields = fixed.get(q.node.name.name);
          if (!fields) return;
          for (const field of [...fields]) {
            const attr = q.node.attributes.find(
              a => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: field })
            );
            if (
              !t.isJSXAttribute(attr) ||
              !t.isJSXExpressionContainer(attr.value) ||
              !numeric(attr.value.expression, name)
            ) {
              fields.delete(field);
              changed = true;
            }
          }
        }
      });
  }
  for (const [name, aliases] of snapshots)
    for (const field of aliases.values())
      if (!fixed.get(name)?.has(field))
        throw new Error(
          `[NATIVE_RECURSION] Snapshot ${name}.${field} is not a fixed numeric prop; ordered snapshot lowering is required. (${file})`
        );
  /** @param {any} node @param {typeof components extends Map<string,infer V> ? V : never} owner @param {Set<string>} [seen] @returns {Color} */
  function color(node, owner, seen = new Set()) {
    const result = empty();
    if (!node) return result;
    if (
      t.isMemberExpression(node) &&
      t.isIdentifier(node.object, { name: owner.param }) &&
      t.isIdentifier(node.property)
    )
      return owner.incoming.get(node.property.name) ?? result;
    if (
      t.isCallExpression(node) &&
      t.isIdentifier(node.callee) &&
      owner.memos.has(node.callee.name)
    ) {
      if (seen.has(node.callee.name)) return result;
      const next = new Set(seen);
      next.add(node.callee.name);
      return color(owner.memos.get(node.callee.name), owner, next);
    }
    if (t.isCallExpression(node) && t.isIdentifier(node.callee, { name: "__nativeAttempt" })) {
      // The effects pass supplies checked failure witnesses. Only a Promise
      // producer adds pending; synchronous attempts remain settled.
      const producer = node.arguments[0];
      result.pending =
        t.isFunction(producer) &&
        (producer.async ||
          (t.isNewExpression(producer.body) &&
            t.isIdentifier(producer.body.callee, { name: "Promise" })));
    }
    if (
      t.isCallExpression(node) &&
      t.isIdentifier(node.callee, { name: "__nativeFailure" }) &&
      t.isArrayExpression(node.arguments[0])
    )
      for (const kind of node.arguments[0].elements)
        if (t.isStringLiteral(kind)) result.fails.add(kind.value);
    if (t.isJSXElement(node) && t.isJSXIdentifier(node.openingElement.name)) {
      const target = components.get(node.openingElement.name.name);
      if (target) merge(result, target.output);
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      const value = node[key];
      for (const child of Array.isArray(value) ? value : [value])
        if (child) merge(result, color(child, owner, seen));
    }
    if (t.isJSXElement(node) && t.isJSXIdentifier(node.openingElement.name, { name: "Loading" }))
      result.pending = false;
    return result;
  }
  // Closed-file prop edges and self recursion use a monotone color fixpoint.
  for (let pass = 0; pass < components.size * 4 + 4; pass++) {
    const before = JSON.stringify(
      [...components].map(([name, c]) => [
        name,
        [...c.incoming].map(([k, v]) => [k, v.pending, [...v.fails]]),
        c.output.pending,
        [...c.output.fails]
      ])
    );
    for (const owner of components.values())
      owner.path.traverse({
        JSXElement(q) {
          if (!t.isJSXIdentifier(q.node.openingElement.name)) return;
          const target = components.get(q.node.openingElement.name.name);
          if (!target) return;
          /** @param {string} name @param {any} expression */
          const edge = (name, expression) => {
            const incoming = target.incoming.get(name) ?? empty();
            merge(incoming, color(expression, owner));
            target.incoming.set(name, incoming);
          };
          for (const attr of q.node.openingElement.attributes)
            if (
              t.isJSXAttribute(attr) &&
              t.isJSXIdentifier(attr.name) &&
              t.isJSXExpressionContainer(attr.value)
            )
              edge(attr.name.name, attr.value.expression);
          for (const child of q.node.children)
            if (t.isJSXExpressionContainer(child)) edge("children", child.expression);
        },
        ReturnStatement(q) {
          if (q.getFunctionParent() === owner.path)
            merge(owner.output, color(q.node.argument, owner));
        }
      });
    const after = JSON.stringify(
      [...components].map(([name, c]) => [
        name,
        [...c.incoming].map(([k, v]) => [k, v.pending, [...v.fails]]),
        c.output.pending,
        [...c.output.fails]
      ])
    );
    if (before === after) break;
    if (pass === components.size * 4 + 3)
      throw new Error("[NATIVE_RECURSION] Prop colors did not converge.");
  }
  const used = new Set();
  /** @param {Color} c */
  const failureType = c => {
    if (!c.fails.size) return t.tsNeverKeyword();
    used.add("__NativeCaught");
    return t.tsTypeReference(
      t.identifier("__NativeCaught"),
      t.tsTypeParameterInstantiation([
        t.tsUnionType([...c.fails].sort().map(k => t.tsLiteralType(t.stringLiteral(k))))
      ])
    );
  };
  for (const [name, info] of components) {
    const q = info.path;
    if (info.props) {
      const colored = [...info.incoming].filter(([, c]) => c.pending || c.fails.size);
      let props = t.cloneNode(info.props, true);
      if (colored.length) {
        used.add("__NativeSource");
        props = t.tsIntersectionType([
          t.tsTypeReference(
            t.identifier("Omit"),
            t.tsTypeParameterInstantiation([
              t.cloneNode(info.props, true),
              t.tsUnionType(colored.map(([k]) => t.tsLiteralType(t.stringLiteral(k))))
            ])
          ),
          t.tsTypeLiteral(
            colored.map(([k, c]) =>
              t.tsPropertySignature(
                t.identifier(k),
                t.tsTypeAnnotation(
                  t.tsTypeReference(
                    t.identifier("__NativeSource"),
                    t.tsTypeParameterInstantiation([
                      t.tsIndexedAccessType(
                        t.cloneNode(info.props, true),
                        t.tsLiteralType(t.stringLiteral(k))
                      ),
                      failureType(c),
                      t.tsLiteralType(t.booleanLiteral(c.pending))
                    ])
                  )
                )
              )
            )
          )
        ]);
      }
      q.node.params[0].typeAnnotation = t.tsTypeAnnotation(props);
      let self = false;
      q.traverse({
        JSXOpeningElement(r) {
          self ||= t.isJSXIdentifier(r.node.name, { name });
        }
      });
      if (self && q.parentPath?.isVariableDeclarator() && t.isIdentifier(q.parentPath.node.id)) {
        used.add("__NativeComponent");
        q.parentPath.node.id.typeAnnotation = t.tsTypeAnnotation(
          t.tsTypeReference(
            t.identifier("__NativeComponent"),
            t.tsTypeParameterInstantiation([
              t.cloneNode(props, true),
              t.tsLiteralType(t.booleanLiteral(info.output.pending)),
              failureType(info.output),
              t.tsLiteralType(t.booleanLiteral(info.output.pending))
            ])
          )
        );
      }
    }
    // Replace plain numeric prop aliases and subsequent pure arithmetic writes.
    // No getters or opaque calls may be duplicated by this bounded mapping.
    const body = /** @type {Path} */ (q.get("body"));
    if (!body.isBlockStatement()) continue;
    /** @type {Map<string,any>} */ const aliases = new Map();
    const statements = /** @type {Path[]} */ (body.get("body"));
    for (const statement of statements) {
      if (statement.isVariableDeclaration() && statement.node.declarations.length === 1) {
        const d = statement.node.declarations[0];
        if (t.isObjectPattern(d.id) && t.isIdentifier(d.init, { name: info.param })) {
          for (const prop of d.id.properties) {
            if (
              !t.isObjectProperty(prop) ||
              prop.computed ||
              !t.isIdentifier(prop.key) ||
              !t.isIdentifier(prop.value)
            )
              throw new Error(
                "[NATIVE_RECURSION] Prop rest/default snapshots need an ordered mapping."
              );
            aliases.set(
              prop.value.name,
              t.memberExpression(t.identifier(info.param), t.cloneNode(prop.key))
            );
          }
          statement.remove();
          continue;
        }
      }
      statement.traverse({
        /** @param {Path} r */
        ReferencedIdentifier(r) {
          const value = aliases.get(r.node.name);
          if (!value || r.findParent(a => a.isTSType())) return;
          // Refuse a shadowed alias instead of replacing another binding.
          const binding = r.scope.getBinding(r.node.name);
          if (binding && binding.scope !== q.scope) return;
          r.replaceWith(t.cloneNode(value, true));
        }
      });
      if (
        statement.isExpressionStatement() &&
        t.isAssignmentExpression(statement.node.expression)
      ) {
        const a = statement.node.expression;
        if (a.operator === "=" && t.isIdentifier(a.left) && aliases.has(a.left.name)) {
          /** @param {any} n @returns {boolean} */
          const pure = n =>
            t.isNumericLiteral(n) ||
            (t.isMemberExpression(n) &&
              t.isIdentifier(n.object, { name: info.param }) &&
              t.isIdentifier(n.property)) ||
            (t.isBinaryExpression(n) &&
              ["+", "-", "*", "/", "%"].includes(n.operator) &&
              pure(n.left) &&
              pure(n.right));
          if (!pure(a.right))
            throw new Error(
              "[NATIVE_RECURSION] A prop snapshot write needs pure numeric arithmetic."
            );
          aliases.set(a.left.name, a.right);
          statement.remove();
        }
      }
    }
    // An early JSX return followed by branch setup becomes Match rows. Keep
    // state creation in the selected row, rather than in a reading setup/view.
    const nodes = /** @type {any[]} */ (q.node.body.body);
    const guard = nodes.findIndex(
      n =>
        t.isIfStatement(n) &&
        !n.alternate &&
        t.isBlockStatement(n.consequent) &&
        n.consequent.body.length === 1 &&
        t.isReturnStatement(n.consequent.body[0])
    );
    if (guard >= 0) {
      const test = nodes[guard].test,
        leaf = nodes[guard].consequent.body[0].argument,
        rest = nodes.slice(guard + 1);
      if (!t.isJSXElement(leaf) && !t.isJSXFragment(leaf))
        throw new Error("[NATIVE_RECURSION] The early branch must return JSX.");
      used.add("__NativeSwitch");
      used.add("__NativeMatch");
      /** @param {any} condition @param {any[]} branch */
      const match = (condition, branch) => {
        const row = t.identifier("_branch");
        row.typeAnnotation = t.tsTypeAnnotation(t.tsUnknownKeyword());
        return t.jsxElement(
          t.jsxOpeningElement(t.jsxIdentifier("__NativeMatch"), [
            t.jsxAttribute(t.jsxIdentifier("when"), t.jsxExpressionContainer(condition))
          ]),
          t.jsxClosingElement(t.jsxIdentifier("__NativeMatch")),
          [t.jsxExpressionContainer(t.arrowFunctionExpression([row], t.blockStatement(branch)))]
        );
      };
      nodes.splice(
        guard,
        nodes.length - guard,
        t.returnStatement(
          t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier("__NativeSwitch"), []),
            t.jsxClosingElement(t.jsxIdentifier("__NativeSwitch")),
            [
              match(t.cloneNode(test, true), [t.returnStatement(leaf)]),
              match(t.unaryExpression("!", t.cloneNode(test, true)), rest)
            ]
          )
        )
      );
    }
  }
  if (used.size) {
    /** @type {Record<string,string[]>} */
    const names = {
      __NativeCaught: ["NativeCaught", "solid-yield/internal", "type"],
      __NativeSource: ["Source", "solid-yield", "type"],
      __NativeComponent: ["Component", "solid-yield", "type"],
      __NativeSwitch: ["Switch", "solid-js", "value"],
      __NativeMatch: ["Match", "solid-js", "value"]
    };
    for (const module of ["solid-yield", "solid-yield/internal", "solid-js"]) {
      const specs = [...used]
        .filter(n => names[n][1] === module)
        .map(n => {
          const s = t.importSpecifier(t.identifier(n), t.identifier(names[n][0]));
          if (names[n][2] === "type") s.importKind = "type";
          return s;
        });
      if (specs.length) p.node.body.unshift(t.importDeclaration(specs, t.stringLiteral(module)));
    }
  }
  return printMapped(t.file(p.node));
}
