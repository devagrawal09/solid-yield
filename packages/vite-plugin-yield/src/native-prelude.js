import { traverseOwned } from "./native-owned.js";
import { copyPosition, printMapped } from "./positions.js";
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
/**
 * F-S48: `export default () => <…/>` (or an anonymous `function`) is a
 * component without a name, and a sugar component needs one. It becomes
 * `export default function Profile() {…}`, named after its file (`index`
 * takes its directory's name), with a suffix if that name is taken.
 * @param {Path} p @param {string} file
 */
function nameDefaultComponent(p, file) {
  const body = /** @type {Path[]} */ (p.get("body"));
  const exported = body.find(q => q.isExportDefaultDeclaration());
  const fn = /** @type {Path | undefined} */ (exported?.get("declaration"));
  if (!fn || !(fn.isArrowFunctionExpression() || fn.isFunction())) return;
  /** @type {any} */ const node = fn.node;
  if (node.id || node.async || node.generator) return;
  let jsx = t.isJSXElement(fn.node.body) || t.isJSXFragment(fn.node.body);
  traverseOwned(fn, {
    Function(inner) {
      if (inner !== fn) inner.skip();
    },
    ReturnStatement(ret) {
      jsx ||= t.isJSXElement(ret.node.argument) || t.isJSXFragment(ret.node.argument);
    }
  });
  if (!jsx) return;
  const parts = file.split(/[\\/]/);
  const base = parts.at(-1)?.replace(/\.[cm]?[jt]sx?$/, "") ?? "Default";
  const stem = (base === "index" ? (parts.at(-2) ?? "Default") : base).replace(/[^A-Za-z0-9]/g, "");
  let name = /^[A-Za-z]/.test(stem) ? stem[0].toUpperCase() + stem.slice(1) : "Default" + stem;
  while (p.scope.hasBinding(name)) name += "Default";
  const block = t.isBlockStatement(fn.node.body)
    ? fn.node.body
    : t.blockStatement([t.returnStatement(/** @type {any} */ (fn.node.body))]);
  const declaration = t.functionDeclaration(t.identifier(name), node.params, block);
  declaration.start = fn.node.start;
  declaration.end = fn.node.end;
  declaration.loc = fn.node.loc;
  // Replace the statement: an expression replaced by a declaration is wrapped.
  /** @type {any} */ (exported).node.declaration = declaration;
  p.scope.crawl();
}
/** Does this function return JSX on some path of its own (not a nested one's)?
 * @param {Path} fn */
const returnsJsx = fn => {
  let jsx = t.isJSXElement(fn.node.body) || t.isJSXFragment(fn.node.body);
  traverseOwned(fn, {
    Function(inner) {
      if (inner !== fn) inner.skip();
    },
    ReturnStatement(ret) {
      jsx ||= t.isJSXElement(ret.node.argument) || t.isJSXFragment(ret.node.argument);
    }
  });
  return jsx;
};
/** A Solid component type annotation (`Component<D>`, `ParentComponent<D>`,
 * `VoidComponent<D>`): its kind and props type. @param {Path | null | undefined} annotation */
const componentType = annotation => {
  if (!annotation?.isTSTypeReference() || !t.isIdentifier(annotation.node.typeName)) return null;
  const binding = annotation.scope.getBinding(annotation.node.typeName.name)?.path;
  const source = binding?.isImportSpecifier()
    ? /** @type {any} */ (binding.parentPath.node).source.value
    : null;
  const imported = binding?.isImportSpecifier() ? binding.node.imported : null;
  const name = t.isIdentifier(imported) ? imported.name : null;
  if (
    source !== "solid-js" ||
    !name ||
    !["Component", "ParentComponent", "VoidComponent"].includes(name)
  )
    return null;
  return { kind: name, props: annotation.node.typeParameters?.params[0] ?? null };
};
/** The components a factory returns: every return of its own is a function
 * returning JSX. `null` when it is not a component factory. @param {Path} declaration */
const factoryReturns = declaration => {
  /** @type {Path[]} */ const returned = [];
  let other = false;
  traverseOwned(declaration, {
    Function(inner) {
      if (inner !== declaration) inner.skip();
    },
    ReturnStatement(ret) {
      const value = ret.get("argument");
      if ((value.isArrowFunctionExpression() || value.isFunctionExpression()) && returnsJsx(value))
        returned.push(value);
      else other = true;
    }
  });
  return returned.length && !other ? returned : null;
};
/** F-S51: is this function declaration a component factory? @param {Path} declaration */
export const componentFactory = declaration =>
  declaration.isFunctionDeclaration() && !!factoryReturns(declaration);
/**
 * F-S51: a component factory, a module-level function that returns a
 * component (Rendering's `RouteHOC(Comp)` returns `(props = {}) => …`). The
 * returned function is named (`RouteHOCComponent`), so every stage treats it as
 * a component; its props take the factory's declared `Component<D>` and lose
 * a default (a component is always given its props object). Each `Component`
 * parameter becomes generic in its colors (`Component<D, P, E, W, R>`), so a
 * factory's component carries what its argument's does; the factory's own
 * return annotation goes (it returns a yield component).
 * @param {Path} p
 */
function componentFactories(p) {
  let factoryTypes = false;
  for (const statement of /** @type {Path[]} */ (p.get("body"))) {
    const declaration = statement.isExportNamedDeclaration()
      ? /** @type {Path} */ (statement.get("declaration"))
      : statement;
    if (!declaration?.isFunctionDeclaration() || !declaration.node.id) continue;
    const returned = factoryReturns(declaration);
    if (!returned) continue;
    const declared = declaration.node.returnType
      ? componentType(declaration.get("returnType.typeAnnotation"))
      : null;
    const factory = declaration.node.id.name;
    for (const fn of returned) {
      const [first] = fn.node.params;
      const param = t.isAssignmentPattern(first) ? first.left : first;
      if (t.isIdentifier(param) && !param.typeAnnotation && declared?.props)
        param.typeAnnotation = t.tsTypeAnnotation(t.cloneNode(declared.props, true));
      if (param && param !== first) fn.node.params[0] = param;
      if (fn.isArrowFunctionExpression()) fn.arrowFunctionToExpression();
      const named = /** @type {any} */ (fn.node);
      if (!named.id)
        named.id = t.identifier(
          `${factory[0].toUpperCase()}${factory.slice(1)}Component`.replace(/^[^A-Za-z]/, "C")
        );
    }
    /** @type {any[]} */ const typeParams =
      /** @type {any} */ (declaration.node.typeParameters)?.params ?? [];
    declaration.get("params").forEach((param, index) => {
      const contract = /** @type {any} */ (param.node).typeAnnotation
        ? componentType(param.get("typeAnnotation.typeAnnotation"))
        : null;
      if (!contract || !t.isIdentifier(param.node)) return;
      const names = ["P", "E", "W", "R"].map(n => `_${n}${index}`);
      typeParams.push(
        t.tsTypeParameter(t.tsBooleanKeyword(), null, names[0]),
        t.tsTypeParameter(null, null, names[1]),
        t.tsTypeParameter(t.tsBooleanKeyword(), null, names[2]),
        t.tsTypeParameter(null, null, names[3])
      );
      param.node.typeAnnotation = t.tsTypeAnnotation(
        t.tsTypeReference(
          t.identifier("__NativeComponent"),
          t.tsTypeParameterInstantiation([
            contract.props ? t.cloneNode(contract.props, true) : t.tsTypeLiteral([]),
            ...names.map(n => t.tsTypeReference(t.identifier(n)))
          ])
        )
      );
      factoryTypes = true;
    });
    if (typeParams.length)
      declaration.node.typeParameters = t.tsTypeParameterDeclaration(typeParams);
    if (declared) declaration.node.returnType = null;
  }
  if (factoryTypes && !p.scope.hasBinding("__NativeComponent")) {
    const source = t.importDeclaration(
      [t.importSpecifier(t.identifier("__NativeComponent"), t.identifier("Component"))],
      t.stringLiteral("solid-yield")
    );
    source.importKind = "type";
    p.node.body.unshift(source);
  }
  p.scope.crawl();
}
/**
 * F-S51: a component written inline as an argument at module level
 * (`const App = RouteHOC(() => …)`) is named after its binding
 * (`AppComponent`) and declared before it.
 * @param {Path} p
 */
function liftInlineComponents(p) {
  for (const statement of /** @type {Path[]} */ (p.get("body"))) {
    const declaration = statement.isExportNamedDeclaration()
      ? /** @type {Path} */ (statement.get("declaration"))
      : statement;
    if (!declaration?.isVariableDeclaration()) continue;
    for (const declarator of /** @type {Path[]} */ (declaration.get("declarations"))) {
      const init = /** @type {Path} */ (declarator.get("init"));
      if (!init?.isCallExpression() || !t.isIdentifier(declarator.node.id)) continue;
      // Solid's own APIs (render, lazy, the primitives) take no component here.
      const callee = init.get("callee");
      const from = callee.isIdentifier() ? api(callee)?.module : null;
      if (from === "solid-js" || from === "@solidjs/web") continue;
      for (const argument of /** @type {Path[]} */ (init.get("arguments"))) {
        if (!(argument.isArrowFunctionExpression() || argument.isFunctionExpression())) continue;
        if (argument.node.async || argument.node.generator || argument.node.params.length > 1)
          continue;
        if (!returnsJsx(argument)) continue;
        const base = declarator.node.id.name;
        let name = `${base[0].toUpperCase()}${base.slice(1)}Component`;
        while (p.scope.hasBinding(name)) name += "Inline";
        const body = t.isBlockStatement(argument.node.body)
          ? argument.node.body
          : t.blockStatement([t.returnStatement(/** @type {any} */ (argument.node.body))]);
        const lifted = t.functionDeclaration(t.identifier(name), argument.node.params, body);
        lifted.loc = argument.node.loc;
        lifted.start = argument.node.start;
        lifted.end = argument.node.end;
        argument.replaceWith(t.identifier(name));
        statement.insertBefore(lifted);
        p.scope.crawl();
      }
    }
  }
}
/**
 * F-S53: a derived store, `const [store] = createStore(fn, seed, options)`, is
 * Solid's projection: the function computes into a draft of the seed. It
 * becomes `const store = createProjection(fn, seed, options)`, which the rest
 * of the lowering already maps to `$projection`. A derived store's setter
 * writes over the projection's own draft; one that is used stays a plain
 * store call, and TypeScript names it.
 * @param {Path} p
 */
function derivedStores(p) {
  /** @type {string | null} */ let local = null;
  traverseOwned(p, {
    VariableDeclarator(q) {
      const init = q.get("init");
      const id = q.node.id;
      if (!init.isCallExpression() || !t.isArrayPattern(id)) return;
      const from = api(init.get("callee"));
      if (from?.module !== "solid-js" || from.name !== "createStore") return;
      if (!init.get("arguments.0").isFunction()) return;
      const [store, setter, ...rest] = id.elements;
      if (!t.isIdentifier(store) || rest.length) return;
      if (setter && (!t.isIdentifier(setter) || q.scope.getBinding(setter.name)?.referenced))
        return;
      if (!local) {
        const declaration = /** @type {Path} */ (
          init.get("callee").scope.getBinding(/** @type {any} */ (init.node.callee).name)?.path
            .parentPath
        );
        const existing = declaration.node.specifiers.find(
          /** @param {any} s */ s =>
            t.isImportSpecifier(s) && key(s.imported) === "createProjection"
        );
        local = existing ? existing.local.name : null;
        if (!local) {
          local = p.scope.hasBinding("createProjection")
            ? p.scope.generateUid("createProjection")
            : "createProjection";
          declaration.node.specifiers.push(
            t.importSpecifier(t.identifier(local), t.identifier("createProjection"))
          );
        }
      }
      init.node.callee = t.identifier(/** @type {string} */ (local));
      q.node.id = t.cloneNode(store);
    }
  });
  if (local) p.scope.crawl();
}
/** @param {any} n */
const key = n => n?.name ?? n?.value;
/**
 * F-S53: a root render whose tree wraps a component in Solid's own markup
 * (`render(() => <Errored …><Loading><App /></Loading></Errored>, el)`, the
 * shape D-099 asks of a pending app) is a component of its entry. It is
 * declared as `Root` before the statement that renders it and rendered as
 * `<Root />`, so its tree is lowered and the root is checked. A tree inside a
 * module-level function may use that function's typed parameters and typed
 * constants (`renderToStream(() => <Shell><App url={url} /></Shell>)` in
 * `render(url: string)`): each becomes a prop of `Root`.
 * @param {Path} p @returns {boolean}
 */
function liftRootTrees(p) {
  /** @type {Path[]} */ const calls = [];
  p.traverse({
    CallExpression(q) {
      const from = api(q.get("callee"));
      if (
        from?.module === "@solidjs/web" &&
        ["render", "hydrate", "renderToString", "renderToStream"].includes(from.name)
      )
        calls.push(q);
    }
  });
  let changed = false;
  for (const call of calls) {
    const statement = call.findParent(q => !!q.parentPath?.isProgram());
    if (!statement) continue;
    const tree = /** @type {Path} */ (call.get("arguments.0"));
    if (!tree?.isArrowFunctionExpression() || tree.node.params.length) continue;
    const body = tree.get("body");
    if (!body.isJSXElement() && !body.isJSXFragment()) continue;
    // A bare `<App />` is the entry's existing checked handoff.
    const opening = body.isJSXElement() ? body.node.openingElement : null;
    if (opening && !opening.attributes.length && !body.node.children.length) continue;
    let component = false,
      lifts = true;
    /** @type {Map<string, any>} the captured locals, with their declared types */
    const captured = new Map();
    /** @type {Path[]} */ const uses = [];
    /** A name bound outside the tree and below module level: a typed
     * parameter or constant of the enclosing function becomes a prop.
     * @param {Path} q @param {boolean} tag */
    const capture = (q, tag) => {
      const binding = q.scope.getBinding(q.node.name);
      if (!binding || binding.scope === p.scope || binding.path.isDescendant(body)) return;
      const declared =
        binding.kind === "param" && binding.path.isIdentifier()
          ? binding.path.node.typeAnnotation
          : binding.kind === "const" && binding.path.isVariableDeclarator()
            ? /** @type {any} */ (binding.path.node.id).typeAnnotation
            : null;
      if (tag || !declared || !t.isTSTypeAnnotation(declared)) {
        lifts = false;
        return;
      }
      captured.set(q.node.name, declared.typeAnnotation);
      uses.push(q);
    };
    body.traverse({
      /** @param {Path} q */
      JSXOpeningElement(q) {
        if (t.isJSXIdentifier(q.node.name) && /^[A-Z]/.test(q.node.name.name)) component = true;
      },
      /** @param {Path} q */
      Identifier(q) {
        if (q.isReferencedIdentifier()) capture(q, false);
      },
      /** @param {Path} q */
      JSXIdentifier(q) {
        if (q.parentPath?.isJSXOpeningElement() || q.parentPath?.isJSXClosingElement())
          capture(q, true);
      }
    });
    if (!component || !lifts) continue;
    let name = "Root";
    while (p.scope.hasBinding(name)) name += "Inline";
    let param = "props";
    while (body.scope.hasBinding(param) || captured.has(param))
      param = `root${param[0].toUpperCase()}${param.slice(1)}`;
    for (const use of uses) {
      const property = use.parentPath;
      if (property?.isObjectProperty() && property.node.shorthand) property.node.shorthand = false;
      use.replaceWith(t.memberExpression(t.identifier(param), t.identifier(use.node.name)));
    }
    const params = captured.size
      ? [
          Object.assign(t.identifier(param), {
            typeAnnotation: t.tsTypeAnnotation(
              t.tsTypeLiteral(
                [...captured].map(([prop, type]) =>
                  t.tsPropertySignature(t.identifier(prop), t.tsTypeAnnotation(t.cloneNode(type)))
                )
              )
            )
          })
        ]
      : [];
    const lifted = t.functionDeclaration(
      t.identifier(name),
      params,
      t.blockStatement([t.returnStatement(body.node)])
    );
    lifted.loc = body.node.loc;
    lifted.start = body.node.start;
    lifted.end = body.node.end;
    body.replaceWith(
      t.jsxElement(
        t.jsxOpeningElement(
          // Reported at the authored tree: a root finding names the render.
          copyPosition(t.jsxIdentifier(name), body.node),
          [...captured.keys()].map(prop =>
            t.jsxAttribute(t.jsxIdentifier(prop), t.jsxExpressionContainer(t.identifier(prop)))
          ),
          true
        ),
        null,
        [],
        true
      )
    );
    statement.insertBefore(lifted);
    p.scope.crawl();
    changed = true;
  }
  return changed;
}
/** Lift each file's root trees (above) before entries are told apart: an entry
 * whose tree is lifted declares a component, so it is lowered as a module.
 * @param {Map<string,string>} files */
export function nativeRootTrees(files) {
  const out = new Map();
  for (const [file, code] of files) {
    if (!/@solidjs\/web/.test(code)) {
      out.set(file, code);
      continue;
    }
    const p = parseProgram(code, file);
    if (!p) {
      out.set(file, code);
      continue;
    }
    out.set(file, liftRootTrees(p) ? printMapped(t.file(p.node)) : code);
  }
  return out;
}
/**
 * F-S53: `isPending(() => store.items)` and `latest(() => feed())` take a
 * thunk; the library's `isPendingOf` and `latestOf` take the source itself.
 * A thunk that only reads one accessor (`feed()`) or one store path
 * (`store.items`) becomes that source; any other thunk is left as written.
 * @param {Path} p
 */
function pendingThunks(p) {
  traverseOwned(p, {
    CallExpression(q) {
      const from = api(q.get("callee"));
      if (from?.module !== "solid-js" || !["isPending", "latest"].includes(from.name)) return;
      const thunk = q.get("arguments.0");
      if (!thunk?.isArrowFunctionExpression() || thunk.node.params.length || thunk.node.async)
        return;
      /** @type {any} */ let body = thunk.node.body;
      if (t.isBlockStatement(body))
        body =
          body.body.length === 1 && t.isReturnStatement(body.body[0])
            ? body.body[0].argument
            : null;
      if (t.isCallExpression(body) && !body.arguments.length && t.isIdentifier(body.callee))
        body = body.callee;
      else if (!t.isMemberExpression(body) || body.computed) return;
      /** @type {any} */ let root = body;
      while (t.isMemberExpression(root) && !root.computed) root = root.object;
      if (!t.isIdentifier(root)) return;
      thunk.replaceWith(body);
    }
  });
}
/** Normalize native control contracts before routine reconstruction.
 * @param {Map<string,string>} files */
export function nativePrelude(files) {
  const out = new Map();
  for (const [file, code] of files) {
    const p = parseProgram(code, file);
    if (!p) continue;
    const used = new Set();
    nameDefaultComponent(p, file);
    liftInlineComponents(p);
    componentFactories(p);
    derivedStores(p);
    pendingThunks(p);
    traverseOwned(p, {
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
          traverseOwned(method, {
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
          traverseOwned(method, {
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
    traverseOwned(p, {
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
    traverseOwned(p, {
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
            traverseOwned(scope, {
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
          traverseOwned(callback, {
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
