// @ts-check
// Discovers prototypes (prototypes/*/index.mjs) and builds checker inputs for a fixture.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fixturesDir } from "../fixtures/index.mjs";
import { compilerOptions } from "./compiler-options.mjs";
import { nullPrototype } from "./null-prototype.mjs";

/** @typedef {import("../src/types.d.ts").Prototype} Prototype */
/** @typedef {import("../fixtures/schema.d.ts").Fixture} Fixture */

export const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PROTOTYPE_NAMES = Object.freeze(["typed", "dataflow", "oxc"]);

/**
 * @param {string} selection "all" | comma-separated names
 * @returns {Promise<{ prototypes: Prototype[], missing: string[] }>}
 */
export async function loadPrototypes(selection) {
  const wanted = selection === "all" ? [...PROTOTYPE_NAMES] : selection.split(",").map(s => s.trim()).filter(Boolean);
  /** @type {Prototype[]} */
  const prototypes = [];
  /** @type {string[]} */
  const missing = [];
  for (const name of wanted) {
    if (name === "null") { prototypes.push(nullPrototype); continue; }
    const entry = resolve(packageDir, "prototypes", name, "index.mjs");
    if (!existsSync(entry)) { missing.push(name); continue; }
    /** @type {{ name: string, createChecker: Prototype["createChecker"] }} */
    const mod = await import(pathToFileURL(entry).href);
    prototypes.push({ name: mod.name, createChecker: mod.createChecker });
  }
  return { prototypes, missing };
}

/** @param {Fixture} fixture */
export function fixtureFiles(fixture) {
  const rootDir = resolve(fixturesDir, fixture.dir);
  const files = fixture.files.map(f => resolve(rootDir, f));
  return { rootDir, files };
}

/**
 * @param {Prototype} prototype
 * @param {Fixture} fixture
 * @param {Map<string, string>} [overrides] in-memory file texts
 */
export function createCheckerFor(prototype, fixture, overrides) {
  const { rootDir, files } = fixtureFiles(fixture);
  return prototype.createChecker({
    rootDir,
    files,
    compilerOptions,
    readFile: overrides && overrides.size
      ? path => overrides.get(path) ?? (existsSync(path) ? readFileSync(path, "utf8") : undefined)
      : undefined
  });
}
