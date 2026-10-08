// Follow only operations which carry the rejected color in the generated types.
// Boundaries which remove that color stop the walk. Source maps supply locations.
module.exports = function origins(ts, state, target, code, locate) {
  const checker = state.ls.getProgram().getTypeChecker();
  const field = code === "PENDING_ROOT" ? "PENDING" : code === "NO_PROVIDER" ? "REQUIRES" : "FAILS";
  const seen = new Set();
  function property(type, key, node) {
    const p = type.getProperties().find(p => p.name.startsWith(`__@${key}@`));
    return p && checker.getTypeOfSymbolAtLocation(p, node);
  }
  let rootType = checker.getTypeAtLocation(target);
  const signature = rootType.getCallSignatures()[0];
  if (signature) rootType = checker.getReturnTypeOfSignature(signature);
  const remaining = property(rootType, field, target);
  function parts(type) {
    return type.isUnion() ? type.types : [type];
  }
  function operations(node) {
    let type = checker.getTypeAtLocation(node);
    const iterator = type.getProperties().find(p => p.name.startsWith("__@iterator@"));
    const sig =
      iterator && checker.getTypeOfSymbolAtLocation(iterator, node).getCallSignatures()[0];
    if (!sig) return [];
    type = checker.getReturnTypeOfSignature(sig);
    return type.symbol?.name === "Generator" ? parts(checker.getTypeArguments(type)[0]) : [];
  }
  function carries(type, node) {
    const value = property(type, field, node);
    if (!value || value.flags & (ts.TypeFlags.Never | ts.TypeFlags.Any)) return false;
    if (field === "PENDING") return parts(value).some(t => t.intrinsicName === "true");
    return (
      !remaining ||
      parts(value).some(v => parts(remaining).some(r => checker.isTypeAssignableTo(v, r)))
    );
  }
  function symbol(node) {
    let s = checker.getSymbolAtLocation(node);
    if (s?.flags & ts.SymbolFlags.Alias) s = checker.getAliasedSymbol(s);
    return s;
  }
  function at(node, host) {
    const file = node.getSourceFile().fileName;
    const span = locate(state.positions.get(file), node.getStart(), node.getWidth());
    if (span && !span.generated) return { file: state.originals.get(file), ...span, host };
  }
  function authored(node, host) {
    const direct = at(node, host);
    if (direct) return direct;
    let result;
    ts.forEachChild(node, child => {
      result ??= authored(child, host);
    });
    return result;
  }
  function declaration(node, host) {
    for (const d of symbol(node)?.declarations ?? []) {
      if (!state.positions.has(d.getSourceFile().fileName) || seen.has(d)) continue;
      seen.add(d);
      const init = ts.isVariableDeclaration(d) ? d.initializer : d;
      const found = search(init && ts.isYieldExpression(init) ? init.expression : init, host, true);
      if (found) {
        if (["event", "effect"].includes(host) && init && ts.isFunctionLike(init)) {
          found.handler = authored(d.name ?? init, host);
        }
        return found;
      }
    }
  }
  function search(node, host = "view", enter = false) {
    if (!node || (ts.isFunctionLike(node) && !enter)) return;
    if (ts.isYieldExpression(node) && node.expression) {
      const expr = node.expression;
      const ops = operations(expr).filter(type => carries(type, expr));
      if (!ops.length) return;
      const kinds = ops.map(type => property(type, "KIND", expr)?.value);
      if (kinds.includes("context")) return authored(expr, host);
      if (kinds.includes("read")) {
        if (field === "FAILS" && ts.isIdentifier(expr)) {
          const found = declaration(expr, host);
          if (found) return found;
        }
        return authored(expr, host);
      }
      if (kinds.includes("raise")) {
        if (ts.isCallExpression(expr) && symbol(expr.expression)?.name === "attempt") {
          const found = search(expr.arguments[0], host, true);
          if (found) return found;
        }
        return authored(expr, host);
      }
      if (kinds.includes("bind")) host = "event";
      if (kinds.includes("create")) host = "effect";
      if (ts.isCallExpression(expr)) {
        const found = declaration(expr.expression, host);
        if (found) return found;
      } else if (ts.isIdentifier(expr)) {
        const found = declaration(expr, host);
        if (found) return found;
      }
      let found;
      ts.forEachChild(expr, child => {
        found ??= search(child, host, true);
      });
      return found ?? authored(expr, host);
    }
    // A source's declaration creates its memo; its failures live in the callback,
    // rather than in the creation operation. Enter that callback explicitly.
    if (ts.isVariableDeclaration(node)) return search(node.initializer, host);
    if (field === "FAILS" && ts.isThrowStatement(node)) return authored(node.expression, host);
    if (ts.isCallExpression(node)) {
      let found = declaration(node.expression, host);
      for (const arg of node.arguments) found ??= search(arg, host, true);
      return found;
    }
    let found;
    ts.forEachChild(node, child => {
      found ??= search(child, host, enter && !ts.isFunctionLike(node));
    });
    return found;
  }
  return ts.isFunctionLike(target) ? search(target, "event", true) : declaration(target, "view");
};
