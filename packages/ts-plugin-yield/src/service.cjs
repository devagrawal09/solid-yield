const { resolve, dirname, join } = require("node:path");
const {
  lowerNativeProject,
  lowerSugarProject,
  isSugar,
  locate,
  nativeInclude
} = require("vite-plugin-solid-yield/virtual");
const catalog = require("./catalog.cjs");
const findOrigin = require("./origins.cjs");
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
    if (typeof t.value === "string")
      return t.value
        .split("#")
        .at(-1)
        .replace(/@\d+$/, "")
        .replace(/^global:/, "");
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
    if (["HoleRequires", "RequiresOf"].includes(t.aliasSymbol?.name)) return "an unknown context";
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
  const pending =
    c.pending === "true"
      ? "can suspend (pending)"
      : ["false", "none"].includes(c.pending)
        ? "does not suspend"
        : "may suspend (pending)";
  const failures = c.fails.replace(/\b(any|unknown)\b/g, "an unknown error");
  const contexts = c.requires
    .replace(/\b(any|unknown)\b/g, "an unknown context")
    .replace("an an unknown context context", "an unknown context");
  const wait =
    c.wait === "true"
      ? "can wait"
      : ["false", "none"].includes(c.wait)
        ? "does not wait"
        : "may wait";
  return `${pending}; ${c.fails === "none" ? "never fails" : "can fail with " + failures}; ${wait}; ${c.requires === "none" ? "needs no context" : "needs " + contexts}`;
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
    state?.originalLs?.dispose();
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
            messageText: `[${d.code}] ${catalog[d.code] ?? d.message.replace(/^\[[A-Z_]+\]\s*/, "").replace(/\s*\([^\n]*:\d+:\d+\)\.?$/, "")}`
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
      else if ((culprit = yields.find(y => /\bRaise\b/.test(y.type))))
        code = "NATIVE_SETUP_FAILURE";
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
    let origin;
    const related = d.relatedInformation?.map(r => mapped(r, s)) ?? [];
    if (
      ["NATIVE_CALLBACK_FAILURE", "NATIVE_SETUP_FAILURE"].includes(code) &&
      ts.isFunctionLike(scope)
    ) {
      origin = findOrigin(ts, s, scope, code, locate);
    }
    if (["FOREIGN_HANDOFF", "PENDING_ROOT", "NO_PROVIDER"].includes(code)) {
      const target = ts.isSatisfiesExpression(node) ? node.expression : node;
      if (ts.isIdentifier(target)) {
        const colors = colorSummary(ts, checker, target);
        origin = findOrigin(ts, s, target, code, locate);
        const action =
          colors && [colors.fails, colors.requires].includes("any")
            ? "Fix the earlier errors in this component before checking its render call."
            : code === "FOREIGN_HANDOFF"
              ? catalog.failureAdvice(origin?.host ?? "view")
              : catalog[code];
        message = `[${code}] ${action}${colors?.requires !== "none" && code === "NO_PROVIDER" ? " Missing: " + colors.requires + "." : ""}`;
        if (origin?.handler)
          related.push({
            file: origin.handler.file,
            start: origin.handler.sourceStart,
            length: Math.max(1, origin.handler.sourceEnd - origin.handler.sourceStart),
            category: ts.DiagnosticCategory.Message,
            code: d.code,
            messageText: "Catch or declare the failure in this handler."
          });
        if (origin)
          related.push({
            file: s.originals.get(sf.fileName),
            start: at?.sourceStart ?? 0,
            length: Math.max(1, (at?.sourceEnd ?? 1) - (at?.sourceStart ?? 0)),
            category: ts.DiagnosticCategory.Message,
            code: d.code,
            messageText: `Component ${target.text} reaches Solid here. ${colors ? colorsText(colors) : ""}`
          });
      }
    }
    return {
      ...d,
      file: origin?.file ?? s.originals.get(sf.fileName),
      start: origin?.sourceStart ?? at?.sourceStart ?? 0,
      length: Math.max(
        1,
        origin
          ? origin.sourceEnd - origin.sourceStart
          : (at?.sourceEnd ?? 1) - (at?.sourceStart ?? 0)
      ),
      source: "solid-yield",
      messageText: (!origin && (!at || at.generated) ? "[generated] " : "") + message,
      relatedInformation: related.length ? related : undefined
    };
  }
  function diagnostics(file, kind = "semantic") {
    const s = refresh(),
      f = resolve(file);
    s.diagnosticCache ??= new Map();
    if (!s.diagnosticCache.has(kind)) {
      const all = [...s.failures];
      for (const name of host.getScriptFileNames()) {
        const source = resolve(name);
        if (s.selected.has(source) && !s.positions.has(source)) continue;
        const ds =
          kind === "suggestion"
            ? s.ls.getSuggestionDiagnostics(source)
            : kind === "syntactic"
              ? s.ls.getSyntacticDiagnostics(source)
              : s.ls.getSemanticDiagnostics(source);
        all.push(...ds.map(d => mapped(d, s)));
      }
      s.diagnosticCache.set(kind, all);
    }
    // tsserver assumes every primary span belongs to the requested file. Route
    // relocated root errors to the origin file, retaining the handoff as related.
    const result = s.diagnosticCache.get(kind).filter(d => resolve(d.file.fileName) === f);
    return [
      ...new Map(
        result.map(d => [`${d.start}:${d.code}:${d.category}:${d.messageText}`, d])
      ).values()
    ];
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
          displayParts: [{ kind: "text", text: `${node.getText(sf)} — ${colorsText(c)}` }],
          documentation: []
        };
    }
    const at = candidates[0];
    if (!at) return;
    let qi = s.ls.getQuickInfoAtPosition(f, at.start);
    if (
      qi &&
      /Generator|NativeFailure|Source<|Path<|HoleCall|ComponentView|__@/.test(
        qi.displayParts.map(p => p.text).join("")
      )
    ) {
      s.originalLs ??= ts.createLanguageService({
        ...s.virtualHost,
        getCompilationSettings: () => host.getCompilationSettings(),
        getScriptSnapshot: name => host.getScriptSnapshot(name),
        getScriptVersion: name => host.getScriptVersion(name)
      });
      const original = s.originalLs.getQuickInfoAtPosition(f, pos);
      if (original) return original;
      qi = {
        ...qi,
        displayParts: [{ kind: "text", text: "See the component hover for its checks." }]
      };
    }
    return (
      qi && { ...qi, textSpan: { start: at.sourceStart, length: at.sourceEnd - at.sourceStart } }
    );
  }
  return {
    diagnostics,
    quickInfo,
    refresh,
    dispose: () => {
      state?.ls.dispose();
      state?.originalLs?.dispose();
    }
  };
}
module.exports = { createVirtualService, colorSummary, colorsText };
