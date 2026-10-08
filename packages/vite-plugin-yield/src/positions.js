/** Position tables for the pre-JSX virtual program. Each printer pairs its AST
 * with the printed AST. Provenance survives reparse/clone/reorder, without text
 * searches (which confuse repeated identifiers). No generated token is assigned
 * the position of a neighbouring authored token. */
import babel from "@babel/core";
import { resolve } from "node:path";
/** @typedef {{start:number,end:number,sourceStart:number,sourceEnd:number,generated:boolean}} Position
 * @typedef {{start:number,end:number}} Span
 * @typedef {{input:Map<string,string>, roots:WeakMap<object,any>, origins:WeakMap<object,Position>, stages:Map<string,Map<string,Position[]>>, routines:Map<string,{start:number,end:number,name:Span}[]>}} Session */
/** @type {Session | undefined} */ let session;
/** @param {any} n @returns {any[]} */
const children = n =>
  (babel.types.VISITOR_KEYS[n.type] ?? []).flatMap(k => {
    const value = n[k];
    return Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
  });
/** @param {any} n @param {(node:any)=>void} fn */
const walk = (n, fn) => {
  fn(n);
  for (const c of children(n)) walk(c, fn);
};
/** @param {Position[] | undefined} table @param {number} start @param {number} [length] */
export function locate(table, start, length = 0) {
  if (!table) return undefined;
  const end = start + length;
  return table
    .filter(r => r.start <= start && r.end >= end)
    .sort(
      (a, b) => a.end - a.start - (b.end - b.start) || Number(a.generated) - Number(b.generated)
    )[0];
}
/** @param {any} ast @param {string} code @param {string} filename @param {any} parserOpts */
export function trackParsed(ast, code, filename, parserOpts) {
  if (!session) return;
  const file = resolve(filename),
    previous = session?.stages.get(file)?.get(code);
  const original = session.input.get(file) === code;
  session?.roots.set(ast.program, { file, parserOpts, code });
  walk(ast.program, n => {
    if (!n.loc) return;
    const r = previous ? locate(previous, n.start, n.end - n.start) : undefined;
    if (r) session?.origins.set(n.loc, { ...r });
    else if (original)
      session?.origins.set(n.loc, {
        start: n.start,
        end: n.end,
        sourceStart: n.start,
        sourceEnd: n.end,
        generated: false
      });
  });
}
/** @param {string} file @param {number} pos */
function routineAt(file, pos) {
  const routines = session?.routines.get(file) ?? [];
  return (
    routines
      .filter(r => r.start <= pos && r.end >= pos)
      .sort((a, b) => a.end - a.start - (b.end - b.start))[0]?.name ?? { start: 0, end: 0 }
  );
}
/** @param {any} ast */
export function printMapped(ast) {
  const output =
    babel.transformFromAstSync(ast, undefined, {
      configFile: false,
      babelrc: false,
      comments: false,
      cloneInputAst: false
    })?.code ?? "";
  const context = session?.roots.get(ast.program);
  if (!context) return output;
  const printed = babel.parseSync(output, {
    filename: context.file,
    configFile: false,
    babelrc: false,
    parserOpts: context.parserOpts,
    sourceType: "module"
  });
  /** @type {Position[]} */ const table = [];
  /** @param {any} before @param {any} after @param {Span | undefined} [inherited] */
  function pair(before, after, inherited) {
    if (!after) return;
    const compatible = before && before.type === after.type;
    const origin = compatible && before.loc && session?.origins.get(before.loc);
    let fallback = inherited;
    if (origin && !origin.generated) fallback = routineAt(context.file, origin.sourceStart);
    if (!origin || origin.generated) {
      let found = false;
      if (before)
        walk(before, n => {
          const o = n.loc && session?.origins.get(n.loc);
          if (!found && o && !o.generated) {
            const routine = routineAt(context.file, o.sourceStart);
            if (routine.end > routine.start) {
              fallback = routine;
              found = true;
            }
          }
        });
    }
    fallback ??= { start: 0, end: 0 };
    table.push({
      ...(origin && !origin.generated
        ? origin
        : {
            sourceStart: fallback.start,
            sourceEnd: fallback.end,
            generated: true
          }),
      start: after.start,
      end: after.end
    });
    const a = compatible ? children(before) : [],
      b = children(after);
    for (let i = 0; i < b.length; i++) pair(a[i], b[i], fallback);
  }
  pair(ast.program, printed?.program);
  if (!session?.stages.has(context.file)) session?.stages.set(context.file, new Map());
  session?.stages.get(context.file)?.set(output, table);
  return output;
}
/** @template {{files:Map<string,string>}} T @param {Map<string,string>} input @param {()=>T} run @returns {T & {positions:Map<string,Position[]>}} */
export function withPositions(input, run) {
  if (session) return /** @type {T & {positions:Map<string,Position[]>}} */ (run());
  session = {
    input: new Map([...input].map(([f, c]) => [resolve(f), c])),
    roots: new WeakMap(),
    origins: new WeakMap(),
    stages: new Map(),
    routines: new Map()
  };
  try {
    for (const [file, code] of session.input) {
      const ast = babel.parseSync(code, {
        filename: file,
        configFile: false,
        babelrc: false,
        parserOpts: {
          plugins: /** @type {any} */ ([
            ...(/\.[mc]?tsx?$/.test(file) ? ["typescript"] : []),
            ...(!/\.[mc]?ts$/.test(file) ? ["jsx"] : []),
            "decorators"
          ])
        }
      });
      /** @type {{start:number,end:number,name:Span}[]} */ const routines = [];
      walk(ast?.program, n => {
        const fn = babel.types.isFunction(n)
          ? n
          : babel.types.isVariableDeclarator(n) && babel.types.isFunction(n.init)
            ? n.init
            : null;
        const name = n.id ?? /** @type {any} */ (fn)?.id;
        if (fn && name)
          routines.push({
            start: fn.start ?? 0,
            end: fn.end ?? 0,
            name: { start: name.start, end: name.end }
          });
      });
      session.routines.set(file, routines);
    }
    const result = /** @type {T & {positions:Map<string,Position[]>}} */ (run());
    result.positions = new Map(
      [...result.files].map(([f, c]) => [
        f,
        session?.stages.get(f)?.get(c) ?? [
          { start: 0, end: c.length, sourceStart: 0, sourceEnd: c.length, generated: false }
        ]
      ])
    );
    return result;
  } catch (caught) {
    const error = /** @type {any} */ (caught);
    // Transform refusals can arise after several intermediate prints too.
    const file = error.id ?? error.loc?.file;
    if (file && error.loc?.line) {
      const stages = session?.stages.get(resolve(file));
      const last = stages && [...stages].at(-1);
      if (last) {
        const [code, table] = last;
        const lines = code.split("\n");
        const offset =
          lines.slice(0, error.loc.line - 1).reduce((n, s) => n + s.length + 1, 0) +
          (error.loc.column ?? 0);
        const at = locate(table, offset);
        if (at) {
          error.sourceSpan = at;
          const authored = session?.input.get(resolve(file));
          if (authored) {
            const prefix = authored.slice(0, at.sourceStart).split("\n");
            const line = prefix.length,
              column = (prefix.at(-1) ?? "").length;
            error.loc = { ...error.loc, line, column };
            error.message = error.message.replace(/:\d+:\d+\)$/, `:${line}:${column + 1})`);
          }
        }
      }
    }
    throw error;
  } finally {
    session = undefined;
  }
}

/** Mark a replacement's authored origin; synthetic machinery stays unmapped.
 * @template {object} T @param {T} node @param {any} original @returns {T} */
export function copyPosition(node, original) {
  return Object.assign(node, { loc: original.loc });
}
