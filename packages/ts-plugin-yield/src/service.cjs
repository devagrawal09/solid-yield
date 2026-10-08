const { resolve, dirname, join } = require("node:path");
const {
  lowerNativeProject,
  lowerSugarProject,
  isSugar,
  locate,
  nativeInclude
} = require("vite-plugin-solid-yield/virtual");
const catalog = require("./catalog.cjs");
const routineColors = require("./hover.cjs");
const walk = (ts, n, fn) => {
  fn(n);
  ts.forEachChild(n, c => walk(ts, c, fn));
};
function leafAt(ts, sf, pos) {
  let best = sf;
  walk(ts, sf, n => {
    if (n.getStart(sf) <= pos && n.end > pos) best = n;
  });
  return best;
}
function symbolKey(symbol) {
  return symbol.declarations?.[0]?.name?.expression?.text;
}
function colorSummary(ts, checker, node, tuple) {
  const atCall = node.parent && ts.isCallExpression(node.parent) && node.parent.expression === node;
  let type = checker.getTypeAtLocation(atCall ? node.parent : node);
  const componentArgs = type.aliasSymbol?.name === "HoleCall" ? type.aliasTypeArguments : undefined;
  const signatures = type.getCallSignatures();
  if (signatures.length) type = checker.getReturnTypeOfSignature(signatures[0]);
  const properties = type.getProperties();
  const fields = tuple
    ? new Map(["PENDING", "FAILS", "MAY_WAIT", "REQUIRES"].map((k, i) => [k, tuple[i]]))
    : componentArgs
      ? new Map(
          ["PENDING", "FAILS", "MAY_WAIT", "REQUIRES"].map((k, i) => [k, componentArgs[i + 1]])
        )
      : new Map(properties.map(p => [symbolKey(p), checker.getTypeOfSymbolAtLocation(p, node)]));
  if (!fields.has("PENDING") || !fields.has("FAILS")) return;
  function failureName(t) {
    if (t.isUnion()) return t.types.map(failureName).join(" | ");
    if (typeof t.value === "string") return t.value.split("#").at(-1).replace(/@\d+$/, "");
    return show(t);
  }
  function show(t) {
    if (!t || t.flags & ts.TypeFlags.Never) return "none";
    if (t.isUnion()) return [...new Set(t.types.map(show))].join(" | ");
    if (t.aliasSymbol?.name === "NativeFailure") {
      const args = t.aliasTypeArguments;
      return args?.length ? failureName(args[0]) : "unknown";
    }
    if (t.symbol?.name === "NativeFailure") {
      const args = checker.getTypeArguments(t);
      return args?.length ? failureName(args[0]) : "unknown";
    }
    if (t.symbol?.name === "RequiredContext") {
      const args = checker.getTypeArguments(t);
      const id = args?.[1]?.value;
      if (typeof id === "string") return id.split("#").at(-1);
    }
    return checker.typeToString(t, node, ts.TypeFormatFlags.NoTruncation);
  }
  return {
    pending: show(fields.get("PENDING")),
    fails: show(fields.get("FAILS")),
    wait: show(fields.get("MAY_WAIT")),
    requires: show(fields.get("REQUIRES"))
  };
}
function colorsText(c) {
  return `pending ${c.pending}; fails ${c.fails}; may-wait ${c.wait}; requires ${c.requires}`;
}
function createVirtualService(ts, host, config = {}) {
  let state, signature;
  const configPath = host.getCompilationSettings().configFilePath;
  const root = configPath ? dirname(configPath) : host.getCurrentDirectory();
  const include = config.mode === "native" ? nativeInclude(root, config.include) : () => false;
  function refresh() {
    const names = host
      .getScriptFileNames()
      .filter(
        f => !/\.d\.[cm]?ts$/.test(f) && !f.includes("/node_modules/") && /\.[mc]?[jt]sx?$/.test(f)
      );
    const input = new Map(
      names.map(f => {
        const s = host.getScriptSnapshot(f);
        return [resolve(f), s?.getText(0, s.getLength()) ?? ""];
      })
    );
    const next = JSON.stringify([
      host.getCompilationSettings(),
      host.getProjectVersion?.(),
      host.getScriptFileNames().map(f => [f, host.getScriptVersion(f)]),
      [...input]
    ]);
    if (next === signature) return state;
    state?.ls?.dispose();
    signature = next;
    const originals = new Map(
      [...input].map(([f, c]) => [f, ts.createSourceFile(f, c, ts.ScriptTarget.Latest, true)])
    );
    const native = new Map([...input].filter(([f]) => include(f)));
    const sugar = new Map([...input].filter(([f, c]) => !native.has(f) && isSugar(c)));
    const selected = new Set([...native.keys(), ...sugar.keys()]);
    const generated = new Map(input),
      positions = new Map(),
      failures = [];
    const options = {
      ...host.getCompilationSettings(),
      noEmit: true,
      declaration: false,
      emitDeclarationOnly: false
    };
    // Native source projects need not have a library dependency of their own.
    const lib = dirname(require.resolve("solid-yield/package.json"));
    options.paths = {
      ...options.paths,
      "solid-yield": [join(lib, "dist/types/index.d.ts")],
      "solid-yield/internal": [join(lib, "dist/types/internal.d.ts")],
      "solid-yield/jsx-runtime": [join(lib, "jsx/jsx-runtime.d.ts")]
    };
    for (const [files, lower] of [
      [native, lowerNativeProject],
      [sugar, lowerSugarProject]
    ]) {
      if (!files.size) continue;
      try {
        const result = lower(files, { compilerOptions: options });
        for (const [f, code] of result.files) {
          const prefix = "/** @jsxImportSource solid-yield */\n";
          generated.set(f, prefix + code);
          positions.set(
            f,
            result.positions
              .get(f)
              .map(r => ({ ...r, start: r.start + prefix.length, end: r.end + prefix.length }))
          );
        }
        for (const d of result.diagnostics ?? []) {
          const file = originals.get(d.file);
          if (!file) continue;
          failures.push({
            file,
            start: file.getPositionOfLineAndCharacter(d.line - 1, d.column - 1),
            length: 1,
            category: ts.DiagnosticCategory.Warning,
            code: 95001,
            source: "solid-yield",
            messageText: `[${d.code}] ${d.message}`
          });
        }
      } catch (e) {
        const ds = e.diagnostics ?? [
          {
            file: e.id ?? e.loc?.file ?? [...files.keys()][0],
            line: e.loc?.line ?? 1,
            column: (e.loc?.column ?? 0) + 1,
            code: e.code ?? "TRANSFORM",
            message: e.message
          }
        ];
        for (const d of ds) {
          const file = originals.get(resolve(d.file)) ?? originals.get([...files.keys()][0]);
          const start =
            e.sourceSpan?.sourceStart ??
            file.getPositionOfLineAndCharacter(
              Math.min(d.line - 1, file.getLineStarts().length - 1),
              d.column - 1
            );
          failures.push({
            file,
            start,
            length: Math.max(1, (e.sourceSpan?.sourceEnd ?? start + 1) - start),
            code: 95000,
            source: "solid-yield",
            category: ts.DiagnosticCategory.Error,
            messageText: `[${d.code}] ${d.message.replace(/^\[[A-Z_]+\]\s*/, "").replace(/\s*\([^\n]*:\d+:\d+\)\.?$/, "")}`
          });
        }
      }
    }
    const overrides = {
      getCompilationSettings: () => options,
      getScriptFileNames: () => host.getScriptFileNames(),
      getProjectVersion: () => next,
      getScriptVersion: f => (generated.has(resolve(f)) ? next : host.getScriptVersion(f)),
      getScriptSnapshot: f =>
        generated.has(resolve(f))
          ? ts.ScriptSnapshot.fromString(generated.get(resolve(f)))
          : host.getScriptSnapshot(f),
      readFile: f => generated.get(resolve(f)) ?? host.readFile?.(f) ?? ts.sys.readFile(f),
      fileExists: f => generated.has(resolve(f)) || (host.fileExists?.(f) ?? ts.sys.fileExists(f))
    };
    // Do not reuse tsserver's resolver: it may cache the original JSX imports.
    overrides.resolveModuleNames = undefined;
    overrides.resolveModuleNameLiterals = undefined;
    // tsserver's project host also has updateFromProject hooks for its own
    // service. Passing those to a second service prevents it building a program.
    const virtualHost = {
      ...overrides,
      getCurrentDirectory: () => host.getCurrentDirectory(),
      getDefaultLibFileName: o => host.getDefaultLibFileName(o),
      useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames
    };
    for (const key of [
      "readDirectory",
      "directoryExists",
      "getDirectories",
      "realpath",
      "getScriptKind",
      "getProjectReferences",
      "getCancellationToken"
    ]) {
      if (typeof host[key] === "function") virtualHost[key] = host[key].bind(host);
      else if (typeof ts.sys[key] === "function") virtualHost[key] = ts.sys[key].bind(ts.sys);
    }
    state = {
      originals,
      generated,
      positions,
      selected,
      failures,
      virtualHost,
      ls: ts.createLanguageService(virtualHost)
    };
    return state;
  }
  function mapped(d, s) {
    if (!d.file || !s.positions.has(d.file.fileName)) return d;
    const sf = d.file,
      checker = s.ls.getProgram().getTypeChecker();
    let start = d.start ?? 0,
      length = d.length ?? 0,
      message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    let code = Object.keys(catalog).find(k => message.includes(`[${k}]`));
    // TS rejects a host's generator at its wrapper. Find the inadmissible
    // operation in that rejected generator using its library operation type.
    const node = leafAt(ts, sf, start);
    let scope = node;
    while (scope.parent && !ts.isCallExpression(scope) && !ts.isFunctionLike(scope))
      scope = scope.parent;
    if (ts.isCallExpression(scope)) scope = scope.arguments.find(ts.isFunctionLike) ?? scope;
    const yields = [];
    function operations(n) {
      if (n !== scope && ts.isFunctionLike(n)) return;
      if (ts.isYieldExpression(n) && n.expression) {
        let value = checker.getTypeAtLocation(n.expression);
        const iterator = value.getProperties().find(p => p.name.startsWith("__@iterator@"));
        const signature =
          iterator && checker.getTypeOfSymbolAtLocation(iterator, n).getCallSignatures()[0];
        if (signature) value = checker.getReturnTypeOfSignature(signature);
        if (value.symbol?.name === "Generator") value = checker.getTypeArguments(value)[0];
        const type = checker.typeToString(value, n, ts.TypeFormatFlags.NoTruncation);
        yields.push({ node: n, type });
      }
      ts.forEachChild(n, operations);
    }
    operations(scope);

    let culprit;
    if (message.includes("SetupOp")) {
      culprit = yields.find(y => /\b(Read|Source|Path)\b/.test(y.type));
      if (culprit) code = "READ_IN_SETUP";
      else if (message.includes("Element")) {
        walk(ts, scope, n => {
          if (!culprit && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)))
            culprit = { node: n };
        });
        if (culprit) code = "JSX_IN_SETUP";
      }
    } else if (/MemoOp|HoleOp|ViewOp|ComputeOp/.test(message)) {
      culprit = yields.find(y => /\b(Write|EventCallOp)\b/.test(y.type));
      if (culprit) code = "WRITE_IN_REACTIVE";
      else {
        culprit = yields.find(y => /\bCreate/.test(y.type));
        if (culprit) code = "CREATE_OUTSIDE_SETUP";
      }
    }
    if (culprit) {
      start = culprit.node.expression?.getStart(sf) ?? culprit.node.getStart(sf);
      length = (culprit.node.expression ?? culprit.node).getWidth(sf);
    }
    let at =
      locate(s.positions.get(sf.fileName), start, length) ??
      locate(s.positions.get(sf.fileName), start);
    if (code) message = `[${code}] ${catalog[code]}`;
    else if (
      /\[\w+\]|__@|\b(Generator|HoleCall|ComponentView|NativeFailure|SetupOp|ViewOp|MemoOp)\b/.test(
        message
      )
    ) {
      const branded = /\[([A-Z_]+)\] ([^'"\n]+)/.exec(message);
      message = branded
        ? `[${branded[1]}] ${branded[2]}`
        : `[GENERATED_TYPE] ${catalog.GENERATED_TYPE} Check the operation and its enclosing host.`;
    }
    // Expand foreign handoff diagnostics from the actual generated component type.
    if (code === "FOREIGN_HANDOFF" || code === "PENDING_ROOT" || code === "NO_PROVIDER") {
      const target = ts.isSatisfiesExpression(node) ? node.expression : node;
      if (ts.isIdentifier(target)) {
        const colors = colorSummary(ts, checker, target);
        if (colors) {
          const action =
            code === "FOREIGN_HANDOFF"
              ? "not handled — wrap in Errored or handle with attempt/catch"
              : catalog[code];
          message = `[${code}] Component ${target.text}: ${colorsText(colors)}; ${action}`;
        }
      }
    }
    return {
      ...d,
      file: s.originals.get(sf.fileName),
      start: at?.sourceStart ?? 0,
      length: Math.max(1, (at?.sourceEnd ?? 1) - (at?.sourceStart ?? 0)),
      source: "solid-yield",
      messageText: (at?.generated ? "[generated] " : "") + message,
      relatedInformation: d.relatedInformation?.map(r => mapped(r, s))
    };
  }
  function diagnostics(file, kind = "semantic") {
    const s = refresh(),
      f = resolve(file);
    const failures = s.failures.filter(d => d.file.fileName === f);
    if (s.selected.has(f) && !s.positions.has(f)) return failures;
    const ds =
      kind === "suggestion"
        ? s.ls.getSuggestionDiagnostics(f)
        : kind === "syntactic"
          ? s.ls.getSyntacticDiagnostics(f)
          : s.ls.getSemanticDiagnostics(f);
    const result = [...failures, ...ds.map(d => mapped(d, s))];
    return [...new Map(result.map(d => [`${d.start}:${d.messageText}`, d])).values()];
  }
  function quickInfo(file, pos) {
    const s = refresh(),
      f = resolve(file),
      table = s.positions.get(f);
    if (!table) return s.ls.getQuickInfoAtPosition(f, pos);
    const candidates = table
      .filter(r => !r.generated && r.sourceStart <= pos && r.sourceEnd > pos)
      .sort(
        (a, b) =>
          a.sourceEnd - a.sourceStart - (b.sourceEnd - b.sourceStart) ||
          a.end - a.start - (b.end - b.start)
      );
    const program = s.ls.getProgram(),
      sf = program.getSourceFile(f),
      checker = program.getTypeChecker();
    for (const at of candidates) {
      const node = leafAt(ts, sf, at.start),
        c = colorSummary(ts, checker, node) ?? routineColors(ts, s, f, node, colorSummary);
      const qi = s.ls.getQuickInfoAtPosition(f, at.start);
      if (!qi) continue;
      if (c)
        return {
          ...qi,
          textSpan: { start: at.sourceStart, length: at.sourceEnd - at.sourceStart },
          displayParts: [{ kind: "text", text: `${node.getText(sf)}: ${colorsText(c)}` }],
          documentation: []
        };
    }
    const at = candidates[0];
    if (!at) return;
    const qi = s.ls.getQuickInfoAtPosition(f, at.start);
    return (
      qi && { ...qi, textSpan: { start: at.sourceStart, length: at.sourceEnd - at.sourceStart } }
    );
  }
  return { diagnostics, quickInfo, refresh, dispose: () => state?.ls.dispose() };
}
module.exports = { createVirtualService, colorSummary, colorsText };
