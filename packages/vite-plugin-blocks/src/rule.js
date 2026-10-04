// @ts-check
/**
 * The one block rule of the JSX transform (generator blocks as a library,
 * `documentation/plans/blocks-library.md` §5), lifted from the Babel twin of
 * the fork's compiler rule (`packages/babel-plugin/src/shared/blocks-rule.ts`,
 * itself the twin of `packages/compiler/src/blocks_rule.rs`; D-003, D-043).
 *
 * Inside a JSX expression or attribute value, `yield* e` becomes `perform(e)`
 * (imported from `blocksModule`, default `@solidjs/blocks`), so the expression
 * is a call, the JSX compiler treats it as dynamic, and the view generator
 * runs once. Nothing else is lowered and the rule is purely syntactic: a
 * block-component call written as a hole (`{yield* Card({ todo })}`, D-062) is
 * itself a hole and becomes `perform(Card({ todo }))`; its argument is left as
 * written. The refused positions are exactly `REFUSALS`, pinned by
 * `test/fixtures/rule.json`.
 *
 * Whether a hole runs while a setup is the host (`[JSX_IN_SETUP]`, D-041) is
 * the runtime's business: `perform` asserts it. The rule does not know hosts.
 */

/** @typedef {import("@babel/core").NodePath} NodePath */
/** @typedef {import("@babel/core").types.Program} Program */
/** @typedef {import("@babel/core").types.YieldExpression} YieldExpression */
/** @typedef {import("@babel/core").types.JSXAttribute["name"]} JSXAttributeName */

export const REFUSALS = {
  BLOCKS_YIELD_IN_EVENT:
    "a `yield*` in an event handler prop would read once, at render: read inside the `$event` instead",
  BLOCKS_YIELD_IN_REF: "a `yield*` in a `ref` has no hole to read in: a ref is set once",
  BLOCKS_YIELD_IN_SPREAD:
    "a `yield*` in a spread cannot become a hole: spread an object of values, or pass each prop",
  BLOCKS_YIELD_IN_SPREAD_CHILD: "a `yield*` in a spread child cannot become a hole",
  BLOCKS_PLAIN_YIELD_IN_JSX: "a plain `yield` inside JSX is not a read: use `yield*`"
};

/** @typedef {keyof typeof REFUSALS} RefusalCode */
/** @typedef {"none" | "allowed" | RefusalCode} Hole */

export const DEFAULT_BLOCKS_MODULE = "@solidjs/blocks";

/**
 * @param {JSXAttributeName} name
 * @returns {Hole}
 */
function attributeHole(name) {
  if (name.type === "JSXNamespacedName") {
    const ns = name.namespace.name;
    return ns === "on" || ns === "oncapture" ? "BLOCKS_YIELD_IN_EVENT" : "allowed";
  }
  const n = name.name;
  if (n === "ref") return "BLOCKS_YIELD_IN_REF";
  if (n.length > 2 && n.startsWith("on") && n[2] >= "A" && n[2] <= "Z")
    return "BLOCKS_YIELD_IN_EVENT";
  return "allowed";
}

/**
 * Where a `yield` sits: which hole of the nearest JSX, if any, before a
 * function boundary.
 * @param {NodePath} path
 * @returns {Hole}
 */
function holeOf(path) {
  let parent = path.parentPath;
  while (parent) {
    const node = parent.node;
    if (parent.isFunction() || parent.isClass()) return "none";
    if (node.type === "JSXSpreadAttribute") return "BLOCKS_YIELD_IN_SPREAD";
    if (node.type === "JSXSpreadChild") return "BLOCKS_YIELD_IN_SPREAD_CHILD";
    if (node.type === "JSXExpressionContainer") {
      const owner = parent.parentPath?.node;
      return owner && owner.type === "JSXAttribute" ? attributeHole(owner.name) : "allowed";
    }
    parent = parent.parentPath;
  }
  return "none";
}

/**
 * @typedef {object} Refusal
 * @property {RefusalCode} code
 * @property {string} message `[CODE] message (line:column)`, the compiler's format
 * @property {import("@babel/core").NodePath<YieldExpression>} path
 */

/**
 * The rule as one function: every `yield` of the program that sits in JSX,
 * classified. `holes` are the `yield*`s the rule rewrites (outermost first,
 * in source order), `refusals` the positions it refuses. Applying it is the
 * caller's: `applyBlocksRule` rewrites the AST (the Babel plugin), the Vite
 * transform edits the source text.
 *
 * @param {import("@babel/core").NodePath<Program>} program
 * @returns {{ holes: import("@babel/core").NodePath<YieldExpression>[]; refusals: Refusal[] }}
 */
export function blocksRule(program) {
  /** @type {import("@babel/core").NodePath<YieldExpression>[]} */
  const holes = [];
  /** @type {Refusal[]} */
  const refusals = [];
  program.traverse({
    YieldExpression(path) {
      const hole = holeOf(path);
      if (hole === "none") return;
      /** @type {RefusalCode | undefined} */
      const code = !path.node.delegate
        ? "BLOCKS_PLAIN_YIELD_IN_JSX"
        : hole === "allowed"
          ? undefined
          : hole;
      if (code) {
        const loc = path.node.loc?.start;
        const at = loc ? ` (${loc.line}:${loc.column + 1})` : "";
        refusals.push({ code, message: `[${code}] ${REFUSALS[code]}${at}`, path });
      } else holes.push(path);
    }
  });
  return { holes, refusals };
}

/** An error carrying the refusals, in the compiler's format (one per line). */
export class BlocksRuleError extends Error {
  /** @param {Refusal[]} refusals */
  constructor(refusals) {
    super(refusals.map(r => r.message).join("\n"));
    this.name = "BlocksRuleError";
    /** @type {RefusalCode} */
    this.code = refusals[0].code;
    /** @type {{ code: RefusalCode; line: number; column: number }[]} */
    this.refusals = refusals.map(r => ({
      code: r.code,
      line: r.path.node.loc?.start.line ?? 0,
      column: r.path.node.loc?.start.column ?? 0
    }));
  }
}

/**
 * A fresh local name for the imported `perform`: `_$perform`, as the
 * compiler's rule names it, unless the module already binds that.
 * @param {import("@babel/core").NodePath<Program>} program
 */
export function performLocal(program) {
  return program.scope.generateUid("$perform");
}

/**
 * Apply the rule to a Babel program in place: each hole's `yield* e` becomes
 * `_$perform(e)` and `import { perform as _$perform } from blocksModule` is
 * inserted first, as the compiler's rule does. Throws a `BlocksRuleError`
 * listing every refusal. Returns whether anything was rewritten.
 *
 * @param {import("@babel/core").NodePath<Program>} program
 * @param {typeof import("@babel/core").types} t
 * @param {string} [blocksModule]
 */
export function applyBlocksRule(program, t, blocksModule = DEFAULT_BLOCKS_MODULE) {
  const { holes, refusals } = blocksRule(program);
  if (refusals.length) throw new BlocksRuleError(refusals);
  if (!holes.length) return false;
  const local = performLocal(program);
  // Innermost first, so an outer hole's argument is rewritten before it moves.
  for (const path of holes.slice().reverse()) {
    // a hole is a `yield*`, which always has an argument
    const argument = /** @type {import("@babel/core").types.Expression} */ (path.node.argument);
    path.replaceWith(t.callExpression(t.identifier(local), [argument]));
  }
  const [inserted] = program.unshiftContainer(
    "body",
    t.importDeclaration(
      [t.importSpecifier(t.identifier(local), t.identifier("perform"))],
      t.stringLiteral(blocksModule)
    )
  );
  program.scope.registerDeclaration(inserted);
  return true;
}
