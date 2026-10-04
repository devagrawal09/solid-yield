// @ts-check
/**
 * The `lazy()` module-URL pass for the library's `lazy` (D-047).
 *
 * `@solidjs/vite-plugin` annotates `lazy(() => import("x"))` only when `lazy`
 * is imported from `solid-js` (its native `transformLazy` pass). The library
 * exports its own `lazy` with the same signature (`fn`, `options`,
 * `moduleUrl`), so this pass writes the same annotation for a `lazy` imported
 * from the blocks module: a third argument
 * `"__SOLID_LAZY_MODULE__:<specifier>"`, with `void 0` filling the options
 * slot when the call omits it. `@solidjs/vite-plugin` resolves the
 * placeholder to the project-relative module path after compiling (its
 * `resolveLazyModuleUrls`), as it does for its own pass. The placeholder
 * format is that plugin's frozen contract.
 *
 * Eligibility mirrors the compiler's pass (`packages/compiler/src/lazy.rs`):
 * the callee is the bare identifier `lazy`, bound to a named import of `lazy`
 * from the blocks module (an aliased import is not matched, as there); the
 * first argument is an arrow or function whose body is `import("literal")` or
 * a block whose one statement returns it; the call has one argument, or two
 * with an expression second. Three or more arguments mean the call is
 * annotated already.
 */

/** @typedef {import("@babel/core").NodePath} NodePath */
/** @typedef {import("@babel/core").types.Program} Program */
/** @typedef {import("@babel/core").types.CallExpression} CallExpression */
/** @typedef {import("@babel/core").types.Node} Node */

export const LAZY_PLACEHOLDER_PREFIX = "__SOLID_LAZY_MODULE__:";

/**
 * `() => import("x")`, `() => { return import("x"); }` and the `function`
 * forms: the literal specifier, or null.
 * @param {Node} node
 * @returns {string | null}
 */
function dynamicImportSpecifier(node) {
  if (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") return null;
  /** @type {Node | null | undefined} */
  let returned;
  if (node.body.type === "BlockStatement") {
    const body = node.body.body;
    if (body.length !== 1 || body[0].type !== "ReturnStatement") return null;
    returned = body[0].argument;
  } else returned = node.body;
  if (!returned) return null;
  // `import("x")` parses as a call on `Import` (or an `ImportExpression`
  // with `createImportExpressions`); `import("x", opts)` and phase imports
  // are not matched, as in the compiler's pass.
  if (returned.type === "CallExpression" && returned.callee.type === "Import") {
    if (returned.arguments.length !== 1) return null;
    const source = returned.arguments[0];
    return source.type === "StringLiteral" ? source.value : null;
  }
  if (returned.type === "ImportExpression") {
    if (returned.options || returned.phase) return null;
    return returned.source.type === "StringLiteral" ? returned.source.value : null;
  }
  return null;
}

/**
 * Every eligible `lazy(…)` call of the program, with its specifier.
 * @param {import("@babel/core").NodePath<Program>} program
 * @param {string} blocksModule
 * @returns {{ path: import("@babel/core").NodePath<CallExpression>; specifier: string; padOptions: boolean }[]}
 */
export function lazyCalls(program, blocksModule) {
  /** @type {{ path: import("@babel/core").NodePath<CallExpression>; specifier: string; padOptions: boolean }[]} */
  const found = [];
  const imported = program.node.body.some(
    s =>
      s.type === "ImportDeclaration" &&
      s.source.value === blocksModule &&
      s.specifiers.some(
        sp =>
          sp.type === "ImportSpecifier" &&
          sp.local.name === "lazy" &&
          (sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value) === "lazy"
      )
  );
  if (!imported) return found;
  program.traverse({
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      if (callee.type !== "Identifier" || callee.name !== "lazy") return;
      const binding = path.scope.getBinding("lazy");
      if (!binding || binding.kind !== "module") return;
      const declaration = binding.path.parentPath?.node;
      if (
        !binding.path.isImportSpecifier() ||
        !declaration ||
        declaration.type !== "ImportDeclaration" ||
        declaration.source.value !== blocksModule
      )
        return;
      if (args.length === 0 || args.length > 2) return;
      if (
        args.length === 2 &&
        (args[1].type === "SpreadElement" || args[1].type === "ArgumentPlaceholder")
      )
        return;
      const specifier = dynamicImportSpecifier(args[0]);
      if (specifier == null) return;
      found.push({ path, specifier, padOptions: args.length === 1 });
    }
  });
  return found;
}

/**
 * Apply the pass to a Babel program in place. Returns whether a call was
 * annotated.
 * @param {import("@babel/core").NodePath<Program>} program
 * @param {typeof import("@babel/core").types} t
 * @param {string} blocksModule
 */
export function applyLazyModuleUrl(program, t, blocksModule) {
  const calls = lazyCalls(program, blocksModule);
  for (const { path, specifier, padOptions } of calls) {
    if (padOptions) path.node.arguments.push(t.unaryExpression("void", t.numericLiteral(0)));
    path.node.arguments.push(t.stringLiteral(LAZY_PLACEHOLDER_PREFIX + specifier));
  }
  return calls.length > 0;
}
