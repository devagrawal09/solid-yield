// Materialize the library's own color aliases for a routine/source in its lexical
// scope. This is a disposable type-only query, never part of runtime output or
// the diagnostic program. There is no second operation/color checker here.
module.exports = function routineColors(ts, state, file, node, summarize) {
  if (!ts.isIdentifier(node)) return;
  const program = state.ls.getProgram(),
    checker = program.getTypeChecker();
  let type = checker.getTypeAtLocation(node);
  const signature = type.getCallSignatures()[0];
  if (signature) type = checker.getReturnTypeOfSignature(signature);
  if (
    !["Generator", "Yieldable", "Source", "Path", "Receipt", "EventCall"].includes(
      type.aliasSymbol?.name ?? type.symbol?.name
    )
  )
    return;
  let scope = node.parent;
  while (scope && !ts.isBlock(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
  if (!scope) return;
  const code = state.generated.get(file);
  let name = "__solidYieldHover";
  while (code.includes(name)) name += "_";
  const insert = ts.isSourceFile(scope) ? scope.end : scope.end - 1;
  const query = `\ntype ${name}Value = typeof ${node.text};
type ${name}Result = ${name}Value extends (...args: any[]) => infer T ? T : ${name}Value;
type ${name}Ops = ${name}Result extends { [Symbol.iterator](): Generator<infer Y, any, any> } ? Y : never;
type ${name}Colors = [import("solid-yield").PendingOf<${name}Ops>, import("solid-yield").FailsOf<${name}Ops>, import("solid-yield").WaitsOf<${name}Ops>, import("solid-yield").RequiresOf<${name}Ops>];\n`;
  const text = code.slice(0, insert) + query + code.slice(insert);
  const base = state.virtualHost;
  const ls = ts.createLanguageService({
    ...base,
    getProjectVersion: () => base.getProjectVersion() + name,
    getScriptSnapshot: f =>
      f === file ? ts.ScriptSnapshot.fromString(text) : base.getScriptSnapshot(f),
    getScriptVersion: f => base.getScriptVersion(f) + (f === file ? name : "")
  });
  try {
    const p = ls.getProgram(),
      c = p.getTypeChecker();
    let alias;
    const walk = n => {
      if (ts.isTypeAliasDeclaration(n) && n.name.text === name + "Colors") alias = n;
      ts.forEachChild(n, walk);
    };
    walk(p.getSourceFile(file));
    if (!alias) return;
    const tuple = c.getTypeFromTypeNode(alias.type);
    return summarize(ts, c, alias, c.getTypeArguments(tuple));
  } finally {
    ls.dispose();
  }
};
