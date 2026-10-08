#!/usr/bin/env node
const ts = require("typescript");
const { resolve, dirname } = require("node:path");
const { createVirtualService } = require("./service.cjs");
function check(dir, overrides = {}) {
  dir = resolve(dir);
  const configFile = ts.findConfigFile(dir, ts.sys.fileExists);
  if (!configFile) throw new Error("No tsconfig.json found.");
  const raw = ts.readConfigFile(configFile, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, dirname(configFile));
  const plugin = parsed.options.plugins?.find(p => p.name === "ts-plugin-solid-yield") ?? {};
  const config = { ...plugin, ...overrides };
  const host = {
    getCurrentDirectory: () => dirname(configFile),
    getCompilationSettings: () => parsed.options,
    getScriptFileNames: () => parsed.fileNames,
    getScriptVersion: () => "0",
    getScriptSnapshot: f => {
      const c = ts.sys.readFile(f);
      return c === undefined ? undefined : ts.ScriptSnapshot.fromString(c);
    },
    getDefaultLibFileName: o => ts.getDefaultLibFilePath(o),
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
    directoryExists: ts.sys.directoryExists,
    getDirectories: ts.sys.getDirectories
  };
  const service = createVirtualService(ts, host, config);
  try {
    const state = service.refresh();
    const ds = [
      ...(raw.error ? [raw.error] : []),
      ...parsed.errors,
      ...state.ls.getCompilerOptionsDiagnostics()
    ];
    for (const f of parsed.fileNames)
      ds.push(...service.diagnostics(f, "syntactic"), ...service.diagnostics(f));
    const unique = [
      ...new Map(
        ds.map(d => [`${d.file?.fileName}:${d.start}:${d.code}:${d.messageText}`, d])
      ).values()
    ];
    for (const d of unique) {
      const at = d.file?.getLineAndCharacterOfPosition(d.start ?? 0);
      const where = at ? `${d.file.fileName}:${at.line + 1}:${at.character + 1}` : "config";
      console.log(
        `${where} ${ts.DiagnosticCategory[d.category].toLowerCase()} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`
      );
    }
    for (const d of unique)
      for (const r of d.relatedInformation ?? []) {
        const at = r.file?.getLineAndCharacterOfPosition(r.start ?? 0);
        const where = at ? `${r.file.fileName}:${at.line + 1}:${at.character + 1}` : "config";
        console.log(`  related: ${where}: ${ts.flattenDiagnosticMessageText(r.messageText, "\n")}`);
      }
    const errors = unique.filter(d => d.category === ts.DiagnosticCategory.Error).length;
    console.log(`solid-yield check: ${parsed.fileNames.length} files, ${errors} errors`);
    return errors ? 1 : 0;
  } finally {
    service.dispose();
  }
}
if (require.main === module) {
  const [, , command, dir, ...args] = process.argv;
  if (command !== "check" || !dir) {
    console.error("Usage: solid-yield check <dir> [--native <include-glob>]");
    process.exitCode = 2;
  } else
    try {
      const config = {};
      if (args[0] === "--native") {
        config.mode = "native";
        config.include = args.slice(1);
      }
      process.exitCode = check(dir, config);
    } catch (e) {
      console.error(e.stack);
      process.exitCode = 1;
    }
}
module.exports = { check };
