const { resolve, dirname, join } = require("node:path");
const { lowerNativeProject, locate, nativeInclude } = require("vite-plugin-solid-yield/virtual");
const catalog = require("./catalog.cjs");
const findOrigin = require("./origins.cjs");
const routineColors = require("./hover.cjs");
// One document registry per TypeScript instance: the libraries' and packages'
// parsed declarations are shared by every language service it makes, as
// tsserver shares them across projects (each service is disposed when replaced).
const registries = new WeakMap();
/** @param {any} ts */
const registryFor = ts => {
  let registry = registries.get(ts);
  if (!registry) registries.set(ts, (registry = ts.createDocumentRegistry()));
  return registry;
};
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
// Refusal coordinates may belong to intermediate code. Never ask TS to
// convert an invalid coordinate; use the enclosing authored routine instead.
function diagnosticSpan(ts, file, diagnostic, sourceSpan) {
  const starts = file.getLineStarts();
  const line = diagnostic.line - 1,
    column = diagnostic.column - 1;
  const lineEnd =
    Number.isInteger(line) && line >= 0 && line < starts.length
      ? (starts[line + 1] ?? file.text.length)
      : 0;
  const valid =
    Number.isInteger(line) &&
    Number.isInteger(column) &&
    line >= 0 &&
    line < starts.length &&
    column >= 0 &&
    column < lineEnd - starts[line];
  const validSpan =
    sourceSpan &&
    Number.isInteger(sourceSpan.sourceStart) &&
    Number.isInteger(sourceSpan.sourceEnd) &&
    sourceSpan.sourceStart >= 0 &&
    sourceSpan.sourceEnd >= sourceSpan.sourceStart &&
    sourceSpan.sourceEnd <= file.text.length;
  if (validSpan)
    return {
      start: sourceSpan.sourceStart,
      length: Math.min(
        file.text.length - sourceSpan.sourceStart,
        Math.max(1, sourceSpan.sourceEnd - sourceSpan.sourceStart)
      ),
      generated: sourceSpan.generated
    };
  if (valid) return { start: starts[line] + column, length: 1, generated: false };
  const hint = starts[Math.max(0, Math.min(starts.length - 1, Number.isFinite(line) ? line : 0))];
  let routine;
  walk(ts, file, n => {
    if (ts.isFunctionLike(n) && n.getStart(file) <= hint && n.end >= hint) routine = n;
  });
  return {
    start: routine?.getStart(file) ?? 0,
    length: routine?.getWidth(file) ?? file.text.length,
    generated: true
  };
}
function publicNames(text) {
  return text.replace(
    /import\("solid-yield"\)\.ChunkError|__nativeChunk|\bChunkError\b(?!\))/g,
    "a transport failure (ChunkError)"
  );
}
function nativeMessage(code, message) {
  if (code === "SUGAR_ESCAPE") return catalog.SUGAR_ESCAPE;
  // Plain Solid has no authored fails contract to declare here.
  return code === "EVENT_REJECTS"
    ? publicNames(message).replace(/, or declare (?:the failure|it)\.?/g, ".")
    : publicNames(message);
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
    // a class: its instances carry its symbol, never an alias's
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
  const failures = publicNames(c.fails).replace(/\b(any|unknown)\b/g, "an unknown error");
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
    const selected = new Set(native.keys());
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
    const pending = new Map(native);
    while (pending.size) {
      try {
        const result = lowerNativeProject(pending, { compilerOptions: options });
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
            ...diagnosticSpan(ts, file, d),
            category:
              d.severity === "error" ? ts.DiagnosticCategory.Error : ts.DiagnosticCategory.Warning,
            code: d.severity === "error" ? 95000 : 95001,
            source: "solid-yield",
            messageText: `[${d.code}] ${nativeMessage(d.code, d.message)}`
          });
        }
        break;
      } catch (e) {
        const before = pending.size;
        // an error naming no file is the first pending file's: each retry
        // drops a file, so the loop ends
        const ds = e.diagnostics ?? [
          {
            file: e.id ?? e.loc?.file ?? [...pending.keys()][0],
            line: e.loc?.line ?? 1,
            column: (e.loc?.column ?? 0) + 1,
            code: e.code ?? "TRANSFORM",
            message: e.message
          }
        ];
        for (const d of ds) {
          const refused = resolve(d.file ?? [...pending.keys()][0]);
          const file = originals.get(refused) ?? originals.get([...pending.keys()][0]);
          pending.delete(file.fileName);
          const span = diagnosticSpan(ts, file, d, e.sourceSpan);
          failures.push({
            file,
            start: span.start,
            length: span.length,
            code: 95000,
            source: "solid-yield",
            category: ts.DiagnosticCategory.Error,
            messageText: `${span.generated ? "[generated] " : ""}[${d.code}] ${
              catalog[d.code] ??
              String(d.message)
                .split("\n")[0]
                .replace(/^\[[A-Z_]+\]\s*/, "")
                .replace(/\s*\([^\n]*:\d+:\d+\)\.?$/, "")
            }`
          });
        }
        if (pending.size === before) pending.delete([...pending.keys()][0]);
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
      native: new Set(native.keys()),
      generated,
      inference,
      positions,
      selected,
      failures,
      virtualHost,
      ls: ts.createLanguageService(virtualHost, registryFor(ts))
    };
    return state;
  }
  // Native lowering models some imports and removes others. Check module
  // declarations against the installed packages too: emitted plain Solid
  // still needs those imports to exist. Do not merge original expression
  // errors, whose types intentionally differ in the checked model.
  function originalService(s) {
    return (s.originalLs ??= ts.createLanguageService(
      {
        ...s.virtualHost,
        getCompilationSettings: () => host.getCompilationSettings(),
        getScriptVersion: f =>
          s.selected.has(resolve(f))
            ? `original:${host.getScriptVersion(f)}`
            : host.getScriptVersion(f),
        getScriptSnapshot: f => host.getScriptSnapshot(f),
        readFile: f => host.readFile?.(f) ?? ts.sys.readFile(f),
        fileExists: f => host.fileExists?.(f) ?? ts.sys.fileExists(f)
      },
      registryFor(ts)
    ));
  }
  function originalImports(s, file) {
    return originalService(s)
      .getSemanticDiagnostics(file)
      .filter(d => {
        if (d.category !== ts.DiagnosticCategory.Error || !d.file) return false;
        let node = leafAt(ts, d.file, d.start ?? 0);
        for (; node; node = node.parent)
          if (
            ts.isImportDeclaration(node) ||
            ts.isImportEqualsDeclaration(node) ||
            ts.isImportTypeNode(node) ||
            (ts.isExportDeclaration(node) && node.moduleSpecifier)
          )
            return true;
        return false;
      });
  }
  function mapped(d, s) {
    if (!d.file || !s.positions.has(d.file.fileName)) return d;
    const sf = d.file,
      checker = s.ls.getProgram().getTypeChecker();
    let start = d.start ?? 0,
      length = d.length ?? 0,
      message = ts.flattenDiagnosticMessageText(d.messageText, "\n");
    let code = Object.keys(catalog).find(k => message.includes(`[${k}]`));
    // a prop of `any` or `unknown` (D-034's DeclareProp): its caller's error
    if (!code && /\bDeclareProp</.test(message)) code = "PROP_TYPE";
    // TS rejects a host's generator at its wrapper. Find the inadmissible
    // operation in that rejected generator using its library operation type.
    const node = leafAt(ts, sf, start);
    // A component whose own setup TypeScript refuses has no props type to
    // check its callers against (a generic one, as widening makes it, least
    // of all): the setup's error is the one to fix.
    if (message.includes("[UNDECLARED_PROP]")) {
      let call = node;
      while (call && !ts.isCallExpression(call) && !ts.isStatement(call)) call = call.parent;
      let callee =
        call && ts.isCallExpression(call) && ts.isIdentifier(call.expression)
          ? checker.getSymbolAtLocation(call.expression)
          : undefined;
      if (callee && callee.flags & ts.SymbolFlags.Alias) callee = checker.getAliasedSymbol(callee);
      const setup = callee?.valueDeclaration;
      const init = setup && ts.isVariableDeclaration(setup) ? setup.initializer : undefined;
      if (
        init &&
        ts.isCallExpression(init) &&
        s.ls
          .getProgram()
          .getSemanticDiagnostics(init.getSourceFile())
          .some(
            e =>
              e.category === ts.DiagnosticCategory.Error &&
              (e.start ?? -1) >= init.getStart() &&
              (e.start ?? -1) < init.end
          )
      )
        return null;
    }
    let scope = node;
    while (scope.parent && !ts.isCallExpression(scope) && !ts.isFunctionLike(scope))
      scope = scope.parent;
    if (ts.isCallExpression(scope)) scope = scope.arguments.find(ts.isFunctionLike) ?? scope;
    /** The yields of a generator, each with its library operation type. */
    function operationsOf(fn) {
      const found = [];
      (function visit(n) {
        if (n !== fn && ts.isFunctionLike(n)) return;
        if (ts.isYieldExpression(n) && n.expression) {
          let value = checker.getTypeAtLocation(n.expression);
          const iterator = value.getProperties().find(p => p.name.startsWith("__@iterator@"));
          const signature =
            iterator && checker.getTypeOfSymbolAtLocation(iterator, n).getCallSignatures()[0];
          if (signature) value = checker.getReturnTypeOfSignature(signature);
          if (value.symbol?.name === "Generator") value = checker.getTypeArguments(value)[0];
          const type = checker.typeToString(value, n, ts.TypeFormatFlags.NoTruncation);
          found.push({ node: n, type });
        }
        ts.forEachChild(n, visit);
      })(fn);
      return found;
    }
    const yields = operationsOf(scope);

    let culprit, kind;
    const pick = pattern => (kind = pattern) && (culprit = yields.find(y => pattern.test(y.type)));
    if (message.includes("SetupOp")) {
      if (pick(/\b(Read|Source|Path)\b/)) code = "READ_IN_SETUP";
      else if (pick(/\bRaise\b/)) code = "NATIVE_SETUP_FAILURE";
      // a component's body creates state; it does not write it (D-124)
      else if (pick(/\b(Write|EventCallOp)\b/)) code = "WRITE_IN_REACTIVE";
      else if (message.includes("Element")) {
        walk(ts, scope, n => {
          if (!culprit && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)))
            culprit = { node: n };
        });
        if (culprit) code = "JSX_IN_SETUP";
      }
    } else if (/MemoOp|HoleOp|ViewOp|ComputeOp/.test(message)) {
      if (pick(/\b(Write|EventCallOp)\b/)) code = "WRITE_IN_REACTIVE";
      else if (pick(/\bCreate/)) code = "CREATE_OUTSIDE_SETUP";
    } else if (/EventOp|EffectPhaseOp/.test(message)) {
      // An event and an effect's phase write, but create nothing either.
      if (pick(/\bCreate/)) code = "CREATE_OUTSIDE_SETUP";
      // An effect's phase does not wait (D-083): a read that may be pending
      // belongs in its compute.
      else if (message.includes("EffectPhaseOp") && pick(/\bRead<(?!false\b)/))
        code = "PENDING_IN_EFFECT";
    }
    // A value prop given as a hole (a flow control's `each` or `when`, a
    // component's prop) runs where it is read, as a memo does: a write or a
    // creation in it is the error, though TypeScript reports the whole call.
    if (
      !culprit &&
      (!code || code === "HELD_PROP" || code === "REACTIVE_PROP") &&
      ts.isCallExpression(scope)
    ) {
      const holes = scope.arguments
        .filter(ts.isObjectLiteralExpression)
        .flatMap(o => o.properties)
        .filter(
          p =>
            ts.isPropertyAssignment(p) &&
            ts.isFunctionExpression(p.initializer) &&
            !!p.initializer.asteriskToken &&
            // children and fallback are lazy views (no parameters) or rows,
            // whose setup may create
            (!["children", "fallback"].includes(p.name.getText(sf)) ||
              !p.initializer.parameters.length)
        );
      for (const hole of holes) {
        const ops = operationsOf(hole.initializer);
        if ((culprit = ops.find(y => /\bWrite\b/.test(y.type)))) {
          [code, kind] = ["WRITE_IN_REACTIVE", /\bWrite\b/];
          break;
        }
        if ((culprit = ops.find(y => /\bCreate/.test(y.type)))) {
          [code, kind] = ["CREATE_OUTSIDE_SETUP", /\bCreate/];
          break;
        }
      }
    }
    const span = c => ({
      start: c.node.expression?.getStart(sf) ?? c.node.getStart(sf),
      length: (c.node.expression ?? c.node).getWidth(sf)
    });
    // A wrapper the lowering generated has no authored position: an event
    // handler bound by name runs as `$event(function* (...args) { return yield*
    // add(...args); })`. The operation is inside the routine it delegates to.
    for (let depth = 0; culprit?.node.expression && depth < 4; depth++) {
      const at = locate(s.positions.get(sf.fileName), span(culprit).start, span(culprit).length);
      const call = culprit.node.expression;
      if ((at && !at.generated) || !ts.isCallExpression(call)) break;
      // a generated wrapper around an inline routine (`__nativeHole(function* () { … })`),
      // one called where it stands (a foreign call's lifted arguments), or a
      // call of a routine bound by name
      const inline =
        call.arguments.find(a => ts.isFunctionExpression(a) && !!a.asteriskToken) ??
        (ts.isFunctionExpression(call.expression) && call.expression.asteriskToken
          ? call.expression
          : undefined);
      const declaration =
        !inline && ts.isIdentifier(call.expression)
          ? checker.getSymbolAtLocation(call.expression)?.valueDeclaration
          : undefined;
      const routine =
        inline ??
        (declaration && ts.isVariableDeclaration(declaration)
          ? declaration.initializer
          : declaration);
      if (!routine || !ts.isFunctionLike(routine) || !routine.asteriskToken) break;
      const inner = operationsOf(routine).find(y => kind.test(y.type));
      if (!inner) break;
      culprit = inner;
    }
    // A provider's value its context does not admit: TypeScript tries both
    // forms of `provide` (an init routine, a value) and reports the call. The
    // error is the value form's, at the leaf of the value that does not fit.
    let tsCode = d.code;
    // The refusal brand is one member of a prop's union, not proof
    // that the representation is wrong. A correctly formed read can simply
    // return the wrong value. Compare values before offering source advice.
    if ((code === "REACTIVE_PROP" || code === "HELD_PROP") && s.native.has(sf.fileName)) {
      let property = node;
      while (property && !ts.isPropertyAssignment(property) && !ts.isStatement(property))
        property = property.parent;
      if (property && ts.isPropertyAssignment(property)) {
        const value = property.initializer,
          expected = checker.getContextualType(value);
        const readValue = type => {
          const brand = type.getProperties().find(p => p.name.startsWith("__@SOURCE@"));
          if (brand) return checker.getTypeOfSymbolAtLocation(brand, value);
          const signature = type.getCallSignatures()[0];
          const result = signature && checker.getReturnTypeOfSignature(signature);
          return result?.symbol?.name === "Generator"
            ? checker.getTypeArguments(result)[1]
            : undefined;
        };
        const members = expected?.isUnion() ? expected.types : expected ? [expected] : [];
        const wants =
          code === "REACTIVE_PROP"
            ? members.map(readValue).filter(Boolean)
            : members.filter(type => !type.getProperties().some(p => /^\[[A-Z_]+\] /.test(p.name)));
        const actualType = checker.getTypeAtLocation(value);
        const actual = readValue(actualType) ?? actualType;
        // A plain callback can itself be the representation mistake. Leave
        // that advice alone; native holes and sources have a known read value.
        if (
          wants.length &&
          (readValue(actualType) || !actualType.getCallSignatures().length) &&
          !wants.some(want => checker.isTypeAssignableTo(actual, want))
        ) {
          const literal = wants.some(type => type.flags & ts.TypeFlags.Literal);
          const shown = checker.typeToString(
            literal ? actual : checker.getBaseTypeOfLiteralType(actual)
          );
          const wanted = [...new Set(wants.map(want => checker.typeToString(want)))].join(" | ");
          message = `Type '${shown}' is not assignable to type '${wanted}'.`;
          tsCode = 2322;
          code = undefined;
        }
      }
    }
    // TypeScript reports it at `provide`, or at `value` when the whole value is wrong
    // (D-126: a provider's value for a held slot, or a plain value for a
    // reactive one, is the prop refusal's; plain Solid's error is the type's)
    const prop = code === "HELD_PROP" || code === "REACTIVE_PROP";
    let provide =
      (d.code === 2769 && !code) ||
      (prop && s.native.has(sf.fileName) && (d.code === 2769 || d.code === 2322))
        ? node
        : null;
    while (provide && !ts.isCallExpression(provide) && !ts.isStatement(provide))
      provide = provide.parent;
    if (
      !provide ||
      !ts.isCallExpression(provide) ||
      !ts.isPropertyAccessExpression(provide.expression) ||
      provide.expression.name.text !== "provide"
    )
      provide = null;
    const props = provide?.arguments[0];
    const given =
      props && ts.isObjectLiteralExpression(props)
        ? props.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(sf) === "value")
        : undefined;
    const form =
      given &&
      checker
        .getTypeAtLocation(provide.expression)
        .getCallSignatures()
        .map(sig => sig.parameters[0] && checker.getTypeOfSymbolAtLocation(sig.parameters[0], node))
        .find(type => type?.getProperty("value"));
    // only when it is the value that does not fit (not, say, the children)
    const misfit =
      form &&
      !checker.isTypeAssignableTo(
        checker.getTypeAtLocation(given.initializer),
        checker.getTypeOfSymbolAtLocation(form.getProperty("value"), node)
      );
    if (misfit) {
      // what plain Solid reads: a value, not the source or hole a slot also takes
      const isSource = t => t.getProperties().some(p => p.name.startsWith("__@SOURCE@"));
      // a refusal's message (`{ "[HELD_PROP] …": never }`) is not a type plain Solid has
      const refusal = t => t.getProperties().some(p => /^\[[A-Z_]+\] /.test(p.name));
      const plain = t =>
        (t.isUnion() ? t.types : [t]).filter(
          m => !isSource(m) && !refusal(m) && !/^HoleProp$/.test(m.aliasSymbol?.name ?? "")
        );
      const member = (t, name) => {
        for (const m of plain(t)) {
          const symbol = m.getProperty(name);
          if (symbol) return checker.getTypeOfSymbolAtLocation(symbol, node);
        }
      };
      // reported, as TypeScript reports an object literal, at the name of the
      // property that does not fit
      let at = given.name;
      let value = /** @type {ts.Expression} */ (given.initializer);
      let want = checker.getTypeOfSymbolAtLocation(form.getProperty("value"), node);
      let actual = checker.getTypeAtLocation(value);
      for (let depth = 0; depth < 8 && ts.isObjectLiteralExpression(value); depth++) {
        let next;
        for (const p of value.properties) {
          if (!ts.isPropertyAssignment(p) && !ts.isShorthandPropertyAssignment(p)) continue;
          const expected = member(want, p.name.getText(sf));
          const type = ts.isShorthandPropertyAssignment(p)
            ? checker.getTypeOfSymbolAtLocation(checker.getShorthandAssignmentValueSymbol(p), p)
            : checker.getTypeAtLocation(p.initializer);
          if (expected && !checker.isTypeAssignableTo(type, expected)) {
            next = [p, expected, type];
            break;
          }
        }
        if (!next) break;
        const [p, expected, type] = next;
        [at, value, want, actual] = [
          p.name,
          ts.isPropertyAssignment(p) ? p.initializer : p.name,
          expected,
          type
        ];
      }
      const shown = t => {
        // a lowered source as plain Solid typed it: a store as its value, an accessor as a function
        const brand = t.getProperties().find(p => p.name.startsWith("__@SOURCE@"));
        if (brand) {
          const inner = checker.typeToString(checker.getTypeOfSymbolAtLocation(brand, node));
          // made by a store's constructor, or a signal's (an accessor)
          const symbol = ts.isIdentifier(value)
            ? ts.isShorthandPropertyAssignment(value.parent)
              ? checker.getShorthandAssignmentValueSymbol(value.parent)
              : checker.getSymbolAtLocation(value)
            : undefined;
          let made = symbol?.valueDeclaration;
          while (made && !ts.isVariableDeclaration(made)) made = made.parent;
          let call = made?.initializer;
          while (call && (ts.isYieldExpression(call) || ts.isParenthesizedExpression(call)))
            call = call.expression;
          const callee = call && ts.isCallExpression(call) ? call.expression.getText(sf) : "";
          return /Store|Projection/.test(callee) ? inner : `() => ${inner}`;
        }
        const literal = plain(want).some(m => m.flags & ts.TypeFlags.Literal);
        return checker.typeToString(literal ? t : checker.getBaseTypeOfLiteralType(t));
      };
      const expected = plain(want)
        .map(m => checker.typeToString(m))
        .join(" | ");
      message = `Type '${shown(actual)}' is not assignable to type '${expected}'.`;
      culprit = { node: at };
      tsCode = 2322;
      code = undefined;
    }
    // a read in JSX the body builds: the JSX is what is out of place (D-041)
    if (code === "READ_IN_SETUP" && culprit) {
      let jsx;
      for (let n = culprit.node.parent; n && !ts.isFunctionLike(n); n = n.parent)
        if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) jsx = n;
      if (jsx) [code, culprit] = ["JSX_IN_SETUP", { node: jsx }];
    }
    if (culprit) ({ start, length } = span(culprit));
    let at =
      locate(s.positions.get(sf.fileName), start, length) ??
      locate(s.positions.get(sf.fileName), start);
    if (code) {
      message = `[${code}] ${catalog[code]}`;
      if (code === "NATIVE_SETUP_FAILURE" && /\bunknown\b/.test(culprit?.type ?? ""))
        message = `[${code}] This call has an unknown failure contract; the component body cannot let a failure escape. Catch and handle the failure here, or move the call into an event or rendered work.`;
    } else if (
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
      // A handoff: the library's foreign, or the native lowering's (F-S43).
      const handoffs = ["foreign", "nativeForeign", "nativeForeignProvided"];
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
                      handoffs.includes((declaration.propertyName ?? declaration.name).text)
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
        const rejected =
          code === "NO_PROVIDER"
            ? colors?.requires
            : code === "PENDING_ROOT"
              ? colors?.pending
              : colors?.fails;
        if (rejected === "any") {
          // A poisoned type can erase a sibling's real obligations too.
          // Keep an incomplete-check error rather than silently accepting
          // the render tree, but do not invent a provider or failure type.
          code = "DEPENDENT_TYPE";
        }
        origin = code === "DEPENDENT_TYPE" ? undefined : findOrigin(ts, s, target, code, locate);
        const action =
          code === "DEPENDENT_TYPE"
            ? catalog.DEPENDENT_TYPE
            : code === "FOREIGN_HANDOFF"
              ? catalog.failureAdvice(origin?.host ?? "view", s.native.has(sf.fileName))
              : catalog[code];
        message = `[${code}] ${action}${code === "FOREIGN_HANDOFF" && colors ? " Remaining: " + publicNames(colors.fails) + "." : ""}${colors?.requires !== "none" && code === "NO_PROVIDER" ? " Missing: " + colors.requires + "." : ""}`;
        let eventOwner;
        if (code === "FOREIGN_HANDOFF" && origin?.file) {
          const originalNode = leafAt(ts, origin.file, origin.sourceStart);
          walk(ts, origin.file, n => {
            if (ts.isFunctionDeclaration(n) && n.name?.text === originalNode.getText(origin.file))
              eventOwner = n;
          });
        }
        // the handler's own report, when the origin lies inside it (a
        // generator or a helper declared in the handler)
        const containing =
          code === "FOREIGN_HANDOFF" && origin?.file
            ? s.failures.find(
                d =>
                  d.file.fileName === origin.file.fileName &&
                  d.messageText.startsWith("[EVENT_REJECTS]") &&
                  origin.sourceStart >= d.start &&
                  origin.sourceStart < d.start + d.length
              )
            : undefined;
        if (code === "FOREIGN_HANDOFF" && (origin?.host === "event" || eventOwner || containing)) {
          const event =
            containing ??
            s.failures.find(
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
            messageText: s.native.has(sf.fileName)
              ? "Catch and handle the failure inside this handler."
              : "Catch or declare the failure in this handler."
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
      code: tsCode,
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
      /** The failures an event handler's operations carry, each unhandled kind. */
      const handlerFails = expr => {
        let type = checker.getTypeAtLocation(expr);
        const iterator = type.getProperties().find(p => p.name.startsWith("__@iterator@"));
        const signature =
          iterator && checker.getTypeOfSymbolAtLocation(iterator, expr).getCallSignatures()[0];
        if (!signature) return [];
        type = checker.getReturnTypeOfSignature(signature);
        if (type.symbol?.name !== "Generator") return [];
        const operations = checker.getTypeArguments(type)[0];
        return (operations.isUnion() ? operations.types : [operations]).flatMap(op => {
          const property = op.getProperties().find(p => p.name.startsWith("__@FAILS@"));
          const fails = property && checker.getTypeOfSymbolAtLocation(property, expr);
          return !fails ||
            fails.flags & (ts.TypeFlags.Never | ts.TypeFlags.Any | ts.TypeFlags.TypeParameter)
            ? []
            : [fails];
        });
      };
      const rejects = (fails, node) =>
        `[EVENT_REJECTS] This handler can fail with ${publicNames(
          colorSummary(ts, checker, node, [
            checker.getNeverType(),
            fails,
            checker.getNeverType(),
            checker.getNeverType()
          ]).fails
        )} and nothing catches it; catch and handle the failure inside the handler.`;
      walk(ts, sf, n => {
        // D-124: an `$event` a DOM spread binds (`{...{ onClick: async () => … }}`)
        // is an event attribute too; reported at its authored handler.
        if (
          ts.isCallExpression(n) &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === "__nativeSpread" &&
          n.arguments.length === 1
        ) {
          const spread = n.arguments[0];
          for (const member of checker.getTypeAtLocation(spread).getProperties()) {
            if (!/^on/.test(member.name)) continue;
            const declaration = member.valueDeclaration;
            const value =
              declaration && ts.isPropertyAssignment(declaration)
                ? declaration.initializer
                : undefined;
            if (!value || value.getSourceFile() !== sf) continue;
            // the authored property (its `$event` wrapper is generated)
            const at = locate(
              s.positions.get(file),
              declaration.name.getStart(),
              declaration.name.getWidth()
            );
            if (!at || at.generated) continue;
            let authored;
            walk(ts, original, a => {
              if (ts.isPropertyAssignment(a) && a.name.getStart(original) === at.sourceStart)
                authored = a.initializer;
            });
            const start = authored?.getStart(original) ?? at.sourceStart;
            for (const fails of handlerFails(value))
              result.push({
                file: original,
                start,
                length: Math.max(
                  1,
                  authored ? authored.end - start : at.sourceEnd - at.sourceStart
                ),
                code: 95000,
                category: ts.DiagnosticCategory.Error,
                source: "solid-yield",
                messageText: rejects(fails, value)
              });
          }
          return;
        }
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
          // Generic failures remain in Bind's colors for the component's callers.
          if (
            !fails ||
            fails.flags & (ts.TypeFlags.Never | ts.TypeFlags.Any | ts.TypeFlags.TypeParameter)
          )
            continue;
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
            messageText: `[EVENT_REJECTS] This handler can fail with ${publicNames(colors.fails)} and nothing catches it; catch and handle the failure inside the handler.`
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
        const modeled = s.selected.has(source) && s.positions.has(source);
        if (kind === "semantic" && modeled) all.push(...originalImports(s, source));
        // Unselected consumers must see the authored exports of selected
        // dependencies, not the private generator contracts used to check them.
        // A refused native file has no model either: retain ordinary authored
        // errors alongside the refusal that marks its checking incomplete.
        const language = modeled ? s.ls : originalService(s);
        const ds =
          kind === "suggestion"
            ? language.getSuggestionDiagnostics(source)
            : kind === "syntactic"
              ? language.getSyntacticDiagnostics(source)
              : language.getSemanticDiagnostics(source);
        // Original diagnostics and their related spans already use authored
        // positions, even when related information points into a selected file.
        all.push(...(modeled ? ds.map(d => mapped(d, s)).filter(Boolean) : ds));
      }
      s.diagnosticCache.set(kind, all);
    }
    // tsserver assumes every primary span belongs to the requested file. Route
    // relocated root errors to the origin file, retaining the handoff as related.
    const result = s.diagnosticCache.get(kind).filter(d => resolve(d.file.fileName) === f);
    // Satisfies and the following call reject the same root. Keep one public
    // diagnostic, while preserving ordinary TypeScript errors at that span.
    // TypeScript's own diagnostics may carry a message chain, not a string.
    const text = d => ts.flattenDiagnosticMessageText(d.messageText, "\n");
    const rootCode = d =>
      /^\[(PENDING_ROOT|NO_PROVIDER|FOREIGN_HANDOFF|DEPENDENT_TYPE)\]/.test(text(d));
    const moduleError = result.some(
      d => d.category === ts.DiagnosticCategory.Error && text(d).startsWith("[MODULE_STATE]")
    );
    const withoutCascades = result.filter(
      d =>
        (!(moduleError && text(d).startsWith("[generated] [GENERATED_TYPE]")) &&
          !text(d).includes("Fix the earlier errors")) ||
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
    if (!s.selected.has(f) || !table) return originalService(s).getQuickInfoAtPosition(f, pos);
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
          if (!fn) continue;
          if (fn.timerFails?.length) {
            const failures = fn.timerFails.map(
              id => report.classes.find(k => k.id === id)?.name ?? id
            );
            c.fails = [
              ...new Set([...(c.fails === "none" ? [] : c.fails.split(" | ")), ...failures])
            ].join(" | ");
          }
          if (!/unknown|any/.test(c.fails)) continue;
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
      const original = originalService(s).getQuickInfoAtPosition(f, pos);
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
module.exports = { createVirtualService, colorSummary, colorsText, diagnosticSpan };
