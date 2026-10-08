// Minimal author edit for the two bulk actions: the state read can fail before
// their existing API catch starts. Keep originals byte-identical.
export function fixBulkActionReads(code) {
  for (const name of ["toggleAll", "clearCompleted"]) {
    const start = code.indexOf(`    ${name}: action(function*`);
    if (start < 0) throw new Error(`Missing bulk action ${name}`);
    const open = code.indexOf("{", start);
    const close = code.indexOf("\n    })", open);
    if (close < 0) throw new Error(`Missing bulk action end ${name}`);
    code =
      code.slice(0, open + 1) +
      "\n    try {" +
      code.slice(open + 1, close) +
      "\n    } catch { return false; }" +
      code.slice(close);
  }
  return code;
}

export function fixBulkHandlerArgument(code) {
  const before = "onChange={() => toggleAll(!allCompleted())}";
  const after =
    "onChange={() => { try { return toggleAll(!allCompleted()); } catch { return false; } }}";
  if (!code.includes(before)) throw new Error("Missing bulk handler argument");
  return code.replace(before, after);
}
