// @ts-check
// Installed packages remain type information, never authored analysis roots.
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** @param {string} path */
const normalize = path => resolve(path).replaceAll("\\", "/");
/** @param {string} path */
const canonical = path => { try { return normalize(realpathSync(path)); } catch { return normalize(path); } };

export class ProjectBoundary {
  /** @param {import("typescript").Program} program @param {readonly string[]} files */
  constructor(program, files) {
    this.program = program;
    this.files = new Set(files.map(normalize));
    /** @type {Map<import("typescript").SourceFile, boolean>} */
    this.authored = new Map();
    /** @type {Set<string>} */
    this.installed = new Set();
    const directories = new Set();
    for (const file of files) {
      let directory = dirname(file);
      while (!directories.has(directory)) {
        directories.add(directory);
        const parent = dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
    }
    // Record link targets too: TypeScript may use their real paths, even when
    // an over-inclusive caller also passes the target as an explicit root.
    for (const directory of directories) {
      const modules = join(directory, "node_modules");
      if (!existsSync(modules)) continue;
      for (const entry of readdirSync(modules, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const path = join(modules, entry.name);
        if (entry.name.startsWith("@") && entry.isDirectory()) {
          for (const child of readdirSync(path)) this.installed.add(canonical(join(path, child)));
        } else if (entry.isDirectory() || entry.isSymbolicLink()) this.installed.add(canonical(path));
      }
    }
    for (const sf of program.getSourceFiles()) {
      const path = normalize(sf.fileName);
      const match = path.match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/);
      if (match) this.installed.add(canonical(match[1]));
    }
  }

  /** @param {import("typescript").SourceFile} sf */
  isAuthored(sf) {
    const cached = this.authored.get(sf);
    if (cached !== undefined) return cached;
    const result = this.classify(sf);
    this.authored.set(sf, result);
    return result;
  }

  /** @param {import("typescript").SourceFile} sf */
  classify(sf) {
    const path = normalize(sf.fileName);
    if (!this.files.has(path) || sf.isDeclarationFile || /(?:^|\/)node_modules(?:\/|$)/.test(path) || this.program.isSourceFileFromExternalLibrary(sf)) return false;
    return !this.isInstalled(sf);
  }

  /** @param {import("typescript").SourceFile} sf */
  isInstalled(sf) {
    const path = normalize(sf.fileName);
    if (/(?:^|\/)node_modules(?:\/|$)/.test(path) || this.program.isSourceFileFromExternalLibrary(sf)) return true;
    const real = canonical(path);
    return [...this.installed].some(root => real === root || real.startsWith(root + "/"));
  }
}
