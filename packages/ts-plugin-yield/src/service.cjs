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
    const inference = [];
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
        if (result.inference) inference.push(result.inference);
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
            category:
              d.severity === "error" ? ts.DiagnosticCategory.Error : ts.DiagnosticCategory.Warning,
            code: d.severity === "error" ? 95000 : 95001,
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
      inference,
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
    const related = (d.relatedInformation ?? [])
      .filter(r => r.file && !r.file.isDeclarationFile)
      .map(r => mapped(r, s))
      .filter(Boolean);
    if (
      ["NATIVE_CALLBACK_FAILURE", "NATIVE_SETUP_FAILURE"].includes(code) &&
      ts.isFunctionLike(scope)
    ) {
      origin = findOrigin(ts, s, scope, code, locate);
    }
    if (["FOREIGN_HANDOFF", "PENDING_ROOT", "NO_PROVIDER"].includes(code)) {
      let target = node;
      const unwrap = n =>
        ts.isSatisfiesExpression(n)
          ? n.expression
          : ts.isCallExpression(n) &&
              ts.isIdentifier(n.expression) &&
              (n.expression.text === "foreign" ||
                checker
                  .getSymbolAtLocation(n.expression)
                  ?.declarations?.some(
                    declaration =>
                      ts.isImportSpecifier(declaration) &&
                      (declaration.propertyName ?? declaration.name).text === "foreign"
                  ))
            ? unwrap(n.arguments[0])
            : n;
      if (ts.isCallExpression(scope)) target = unwrap(scope);
      if (target === scope && scope.arguments?.[0] && ts.isSatisfiesExpression(scope.arguments[0]))
        target = unwrap(scope.arguments[0]);
      target = unwrap(target);
      if (ts.isSatisfiesExpression(target.parent)) target = target.parent.expression;
      if (ts.isIdentifier(target)) {
        at = locate(s.positions.get(sf.fileName), target.getStart(), target.getWidth()) ?? at;
        const colors = colorSummary(ts, checker, target);
        origin = findOrigin(ts, s, target, code, locate);
        const action =
          colors && [colors.fails, colors.requires].includes("any")
            ? "Fix the earlier errors in this component before checking its render call."
            : code === "FOREIGN_HANDOFF"
              ? catalog.failureAdvice(origin?.host ?? "view")
              : catalog[code];
        message = `[${code}] ${action}${code === "FOREIGN_HANDOFF" && colors ? " Remaining: " + colors.fails + "." : ""}${colors?.requires !== "none" && code === "NO_PROVIDER" ? " Missing: " + colors.requires + "." : ""}`;
        let eventOwner;
        if (code === "FOREIGN_HANDOFF" && origin?.file) {
          const originalNode = leafAt(ts, origin.file, origin.sourceStart);
          walk(ts, origin.file, n => {
            if (ts.isFunctionDeclaration(n) && n.name?.text === originalNode.getText(origin.file))
              eventOwner = n;
          });
        }
        if (code === "FOREIGN_HANDOFF" && (origin?.host === "event" || eventOwner)) {
          const event = s.failures.find(
            d =>
              d.file.fileName === (origin.handler?.file ?? origin.file).fileName &&
              d.messageText.startsWith("[EVENT_REJECTS]") &&
              (!eventOwner || (d.start >= eventOwner.getStart() && d.start < eventOwner.end))
          );
          if (event) {
            const handoff = {
              file: s.originals.get(sf.fileName),
              start: at?.sourceStart ?? 0,
              length: Math.max(1, (at?.sourceEnd ?? 1) - (at?.sourceStart ?? 0)),
              category: ts.DiagnosticCategory.Message,
              code: event.code,
              messageText: "The app is rendered here."
            };
            event.relatedInformation ??= [];
            if (
              !event.relatedInformation.some(
                r => r.file === handoff.file && r.start === handoff.start
              )
            )
              event.relatedInformation.push(handoff);
            return;
          }
        }
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
            messageText: `The app is rendered here. ${colors ? colorsText(colors) : ""}`
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
      relatedInformation: related.length
        ? [...new Map(related.map(r => [`${r.file.fileName}:${r.start}`, r])).values()]
        : undefined
    };
  }
  function checkedEvents(s) {
    const result = [],
      checker = s.ls.getProgram().getTypeChecker();
    for (const [file, original] of s.originals) {
      if (!s.positions.has(file)) continue;
      const sf = s.ls.getProgram().getSourceFile(file);
      walk(ts, sf, n => {
        if (
          !ts.isJsxAttribute(n) ||
          !/^on[A-Z]/.test(n.name.getText(sf)) ||
          !n.initializer ||
          !ts.isJsxExpression(n.initializer) ||
          !n.initializer.expression
        )
          return;
        const value = n.initializer.expression;
        const expr = ts.isYieldExpression(value) ? value.expression : value;
        if (!expr) return;
        let type = checker.getTypeAtLocation(expr);
        const iterator = type.getProperties().find(p => p.name.startsWith("__@iterator@"));
        const signature =
          iterator && checker.getTypeOfSymbolAtLocation(iterator, expr).getCallSignatures()[0];
        if (!signature) return;
        type = checker.getReturnTypeOfSignature(signature);
        if (type.symbol?.name !== "Generator") return;
        const operations = checker.getTypeArguments(type)[0];
        for (const op of operations.isUnion() ? operations.types : [operations]) {
          const property = op.getProperties().find(p => p.name.startsWith("__@FAILS@"));
          const fails = property && checker.getTypeOfSymbolAtLocation(property, expr);
          if (!fails || fails.flags & (ts.TypeFlags.Never | ts.TypeFlags.Any)) continue;
          const colors = colorSummary(ts, checker, expr, [
            checker.getNeverType(),
            fails,
            checker.getNeverType(),
            checker.getNeverType()
          ]);
          const at = locate(s.positions.get(file), n.getStart(), n.getWidth());
          if (!at || at.generated) continue;
          let authored;
          walk(ts, original, a => {
            if (
              ts.isJsxAttribute(a) &&
              a.name.getText(original) === n.name.getText(sf) &&
              a.getStart() >= at.sourceStart &&
              a.getStart() < at.sourceEnd
            )
              authored = a;
          });
          const handler = authored?.initializer?.expression;
          result.push({
            file: original,
            start: handler?.getStart() ?? at.sourceStart,
            length: handler?.getWidth() ?? Math.max(1, at.sourceEnd - at.sourceStart),
            code: 95000,
            category: ts.DiagnosticCategory.Error,
            source: "solid-yield",
            messageText: `[EVENT_REJECTS] This handler can fail with ${colors.fails} and nothing catches it; wrap the body in try/catch, or declare the failure.`
          });
        }
      });
    }
    return result;
  }
  function diagnostics(file, kind = "semantic") {
    const s = refresh(),
      f = resolve(file);
    if (!s.eventsChecked) {
      s.eventsChecked = true;
      s.failures.push(...checkedEvents(s));
    }
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
        all.push(...ds.map(d => mapped(d, s)).filter(Boolean));
      }
      s.diagnosticCache.set(kind, all);
    }
    // tsserver assumes every primary span belongs to the requested file. Route
    // relocated root errors to the origin file, retaining the handoff as related.
    const result = s.diagnosticCache.get(kind).filter(d => resolve(d.file.fileName) === f);
    // Satisfies and the following call reject the same root. Keep one public
    // diagnostic, while preserving ordinary TypeScript errors at that span.
    const rootCode = d => /^\[(PENDING_ROOT|NO_PROVIDER|FOREIGN_HANDOFF)\]/.test(d.messageText);
    const withoutCascades = result.filter(
      d =>
        !d.messageText.includes("Fix the earlier errors") ||
        !result.some(
          other => other !== d && other.category === ts.DiagnosticCategory.Error && !rootCode(other)
        )
    );
    const preferred = [...withoutCascades].sort(
      (a, b) =>
        (rootCode(a) && a.code === 1360 ? -1 : 0) - (rootCode(b) && b.code === 1360 ? -1 : 0)
    );
    return [
      ...new Map(
        preferred
          .map(d => [
            `${d.start}:${rootCode(d) && [2345, 1360].includes(d.code) ? "root" : d.code}:${d.category}:${d.messageText}`,
            d
          ])
          .reverse()
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
      if (c) {
        let unknown = "";
        for (const report of s.inference ?? []) {
          const fn = report.functions.find(
            fn => fn.name === node.getText(sf) && f.endsWith(fn.file)
          );
          if (!fn || !/unknown|any/.test(c.fails)) continue;
          const reachable = new Set();
          const visit = fn => {
            if (!fn || reachable.has(fn.id)) return;
            reachable.add(fn.id);
            fn.calls.forEach(id => visit(report.functions.find(f => f.id === id)));
          };
          visit(fn);
          const sites = report.unknownOrigins.filter(site =>
            reachable.has(site.owner?.replace(process.cwd(), "<root>"))
          );
          if (sites.length)
            unknown =
              " (from " +
              [
                ...new Set(
                  sites.map(
                    site =>
                      `${site.name} at ${require("node:path").basename(site.file)}:${site.line}`
                  )
                )
              ].join("; ") +
              ")";
        }
        return {
          ...qi,
          textSpan: { start: at.sourceStart, length: at.sourceEnd - at.sourceStart },
          displayParts: [
            {
              kind: "text",
              text: `${node.getText(sf)} — ${colorsText(c).replaceAll("an unknown error", "an unknown error" + unknown)}`
            }
          ],
          documentation: []
        };
      }
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
