// @ts-check
// Re-derives every shared case's source from its origin (origins.mjs) and
// either writes fixtures/cases/<id>.tsx (`node extract.mjs --write`) or
// returns the texts for the byte-identity test.
import ts from "typescript";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ORIGINS } from "./origins.mjs";
import { contextSources } from "./context-sources.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "../../..");
export const casesDir = resolve(here, "cases");

/** @param {string} file */
function tableSources(file) {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true);
  /** @type {Map<string, string>} */
  const constants = new Map();
  /** @type {Map<string, Map<string, string>>} */
  const tables = new Map();
  /** @param {ts.Expression} e @returns {string} */
  const evaluate = e => {
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isTemplateExpression(e))
      return e.head.text + e.templateSpans.map(span => evaluate(span.expression) + span.literal.text).join("");
    if (ts.isIdentifier(e)) {
      const value = constants.get(e.text);
      if (value === undefined) throw new Error(`${file}: unknown template constant ${e.text}`);
      return value;
    }
    throw new Error(`${file}: cannot evaluate ${ts.SyntaxKind[e.kind]}`);
  };
  for (const statement of sf.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const init = declaration.initializer;
      if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init) || ts.isTemplateExpression(init)) {
        try { constants.set(declaration.name.text, evaluate(init)); } catch { /* not a plain constant */ }
      } else if (ts.isArrayLiteralExpression(init)) {
        /** @type {Map<string, string>} */
        const rows = new Map();
        for (const row of init.elements) {
          if (!ts.isArrayLiteralExpression(row) || row.elements.length < 2) continue;
          const [id, source] = row.elements;
          if (!ts.isStringLiteral(id)) continue;
          try { rows.set(id.text, evaluate(source)); } catch { /* not a source row */ }
        }
        if (rows.size) tables.set(declaration.name.text, rows);
      }
    }
  }
  return tables;
}

/** @returns {Promise<Map<string, string>>} id -> source */
export async function deriveSources() {
  /** @type {Map<string, string>} */
  const out = new Map();
  /** @type {Map<string, Map<string, Map<string, string>>>} */
  const tableCache = new Map();
  for (const origin of ORIGINS) {
    if (origin.kind === "script") {
      const mod = await import(pathToFileURL(resolve(repoRoot, origin.file)).href);
      /** @type {{ id: string, source: string }[]} */
      const fixtures = mod.fixtures;
      const found = fixtures.find(f => f.id === origin.id);
      if (!found) throw new Error(`${origin.file}: no fixture ${origin.id}`);
      out.set(origin.id, found.source);
    } else {
      const file = resolve(repoRoot, origin.file);
      let tables = tableCache.get(file);
      if (!tables) { tables = tableSources(file); tableCache.set(file, tables); }
      const source = tables.get(origin.table)?.get(origin.row);
      if (source === undefined) throw new Error(`${origin.file}: no row ${origin.row} in ${origin.table}`);
      out.set(origin.id, source);
    }
  }
  for (const source of contextSources.filter(s => !s.id.startsWith("m-"))) out.set(source.id, source.source);
  return out;
}

if (process.argv.includes("--write")) {
  mkdirSync(casesDir, { recursive: true });
  const sources = await deriveSources();
  for (const [id, source] of sources) writeFileSync(resolve(casesDir, `${id}.tsx`), source);
  console.log(`wrote ${sources.size} cases to ${casesDir}`);
}
