// Site-level equivalents (Dev's ruling, 2026-10-12): mutants read against
// their program and correct to accept, because the edited site has nothing
// left to do. The catalogue's equivalence is per operator; these are single
// sites. Each names the authored line it was read at: if that line changes,
// or the entry matches no mutant or more than one, the run fails, so a mark
// never outlives the reading behind it (sugar-design.md, "The survivors").
// `edit` names the mutated line when one line has two mutants of an operator.
export const siteEquivalents = [
  {
    project: "reviewer-m05_swallow",
    file: "App.tsx",
    line: 14,
    operator: "delete-catch",
    anchor:
      "const items = createMemo(async () => { try { return await fetchItems(); } catch { return []; } });",
    reason: "The Errored around List takes the failure the deleted catch absorbed."
  },
  {
    project: "reviewer-m05_swallow",
    file: "App.tsx",
    line: 14,
    operator: "remove-await",
    anchor:
      "const items = createMemo(async () => { try { return await fetchItems(); } catch { return []; } });",
    reason:
      "`return fetchItems()` in an async function has the awaited form's type; the rejection leaves the try unabsorbed and reaches the same Errored."
  },
  {
    project: "reviewer-m05_swallow",
    file: "App.tsx",
    line: 26,
    operator: "delete-errored",
    anchor: "<Errored fallback={err => <p>failed: {String(err)}</p>}>",
    reason: "List's try/catch absorbs every failure under that boundary; nothing reaches the root."
  },
  {
    project: "review-slots-context",
    file: "App.tsx",
    line: 8,
    operator: "delete-provider",
    anchor: "return <C value={1}><Child /></C>;",
    reason:
      "The program renders nothing: App and Child are exported, so their requirement of C is their callers', as for any library component."
  },
  {
    project: "review-slots-lazy-child",
    file: "App.tsx",
    line: 3,
    operator: "delete-loading",
    anchor: "return <Loading fallback={<p>wait</p>}><p>ready</p></Loading>;",
    reason: "The boundary held static text; nothing below it waits."
  },
  {
    project: "review-slots-catch",
    file: "App.tsx",
    line: 5,
    operator: "delete-catch",
    anchor: "try {",
    reason: "The try held a setter's call, which cannot fail."
  },
  {
    project: "rendering-edges",
    file: "Feed.tsx",
    line: 56,
    operator: "delete-loading",
    anchor: '<Loading fallback="…">',
    reason:
      "The root's Loading (main.tsx, server.tsx) covers Feed; removing Feed's own moves the fallback."
  },
  {
    project: "hole-edges",
    file: "App.tsx",
    line: 23,
    operator: "callback-throw",
    anchor: "rows.items.reduce((sum: number, item: any) => sum + item.cents, 0)",
    reason:
      "The throw is in the total memo's reduce callback; the memo is read only under the Errored, which takes it."
  },
  // Read once the operator seed's base checked clean (2026-10-13): before, its
  // rethrowing click handler reported EVENT_REJECTS and held these checks back.
  {
    project: "operator-seeds",
    file: "App.tsx",
    line: 14,
    operator: "delete-catch",
    anchor: "try { return await readServer(); } catch (e) { throw e; }",
    reason: "The deleted catch only rethrew: without it the failure leaves the same way."
  },
  {
    project: "operator-seeds",
    file: "App.tsx",
    line: 14,
    operator: "remove-await",
    anchor: "try { return await readServer(); } catch (e) { throw e; }",
    reason:
      "Unawaited, the rejection leaves the try without passing the catch, which only rethrew it; the async memo's type is the same."
  },
  {
    project: "operator-seeds",
    file: "server.ts",
    line: 5,
    operator: "server-new-class",
    anchor: "if (false) throw new ServerProblem('server');",
    reason:
      "The throw cannot run (`if (false)`), and the Errored above the memo that reads the server takes a failure of any class."
  },
  // The language surface (scripts/native-surface/programs.mjs, read
  // 2026-10-13): an event's await forms catch their own failures, and a form
  // that throws is shown under an Errored.
  {
    project: "surface-await",
    file: "App.tsx",
    line: 15,
    operator: "async-reject",
    anchor: 'const r = await fetch("/x?n=" + n());',
    reason:
      "The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler."
  },
  {
    project: "surface-await",
    file: "App.tsx",
    line: 16,
    operator: "async-reject",
    anchor: "seen.push(await r.text());",
    reason:
      "The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler."
  },
  {
    project: "surface-await",
    file: "App.tsx",
    line: 16,
    operator: "remove-await",
    anchor: "seen.push(await r.text());",
    reason:
      "Unawaited, the promise is kept as a value (pushed to an `unknown[]`), which type-checks unchanged; that its rejection now floats past the catch is a no-floating-promises concern, outside the catalogue (generate.mjs)."
  },
  {
    project: "surface-await-json",
    file: "App.tsx",
    line: 15,
    operator: "async-reject",
    anchor: 'const r = await fetch("/x");',
    reason:
      "The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler."
  },
  {
    project: "surface-await-json",
    file: "App.tsx",
    line: 16,
    operator: "async-reject",
    anchor: "const data: unknown = await r.json();",
    reason:
      "The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler."
  },
  {
    project: "surface-await-json",
    file: "App.tsx",
    line: 16,
    operator: "remove-await",
    anchor: "const data: unknown = await r.json();",
    reason:
      "Unawaited, the promise is kept as a value (assigned to `unknown`), which type-checks unchanged; that its rejection now floats past the catch is a no-floating-promises concern, outside the catalogue (generate.mjs)."
  },
  {
    project: "surface-await-loop",
    file: "App.tsx",
    line: 16,
    operator: "async-reject",
    anchor: 'const r = await fetch("/x?n=" + x);',
    reason:
      "The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler."
  },
  {
    project: "surface-await-nested",
    file: "App.tsx",
    line: 15,
    operator: "async-reject",
    anchor: 'seen.push(await (await fetch("/x?n=" + n())).text());',
    reason:
      "The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler."
  },
  {
    project: "surface-await-nested",
    file: "App.tsx",
    line: 15,
    operator: "remove-await",
    anchor: 'seen.push(await (await fetch("/x?n=" + n())).text());',
    edit: 'seen.push((await fetch("/x?n=" + n())).text());',
    reason:
      "Unawaited, the promise is kept as a value (the outer one: the text promise pushed to an `unknown[]`), which type-checks unchanged; that its rejection now floats past the catch is a no-floating-promises concern, outside the catalogue (generate.mjs)."
  },
  {
    project: "surface-await-uncaught",
    file: "App.tsx",
    line: 15,
    operator: "async-reject",
    anchor: 'const r = await fetch("/x?n=" + n());',
    reason:
      "The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler."
  },
  {
    project: "surface-promise-kept",
    file: "App.tsx",
    line: 16,
    operator: "async-reject",
    anchor: "const status = await request.then(r => r.status);",
    reason:
      "The throw lands in the form's own try, whose catch absorbs every failure (logged): nothing reaches the handler."
  },
  {
    project: "surface-promise-kept",
    file: "App.tsx",
    line: 16,
    operator: "remove-await",
    anchor: "const status = await request.then(r => r.status);",
    reason:
      "Unawaited, the promise is kept as a value (the status promise pushed to an `unknown[]`), which type-checks unchanged; that its rejection now floats past the catch is a no-floating-promises concern, outside the catalogue (generate.mjs)."
  },
  {
    project: "surface-callback-throw",
    file: "App.tsx",
    line: 12,
    operator: "callback-throw",
    anchor: "seen.push(items().every(x => {",
    reason:
      "The callback already throws; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see."
  },
  {
    project: "surface-callback-reads-throw",
    file: "App.tsx",
    line: 12,
    operator: "callback-throw",
    anchor: "seen.push(items().map(x => {",
    reason:
      "The callback already throws; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see."
  },
  {
    project: "surface-reduce-throw",
    file: "App.tsx",
    line: 12,
    operator: "callback-throw",
    anchor: "seen.push(items().reduce((a, x) => {",
    reason:
      "The callback already throws; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see."
  },
  {
    project: "surface-store-callback-throw",
    file: "App.tsx",
    line: 12,
    operator: "callback-throw",
    anchor: "seen.push(store.list.map(t => {",
    reason:
      "The callback already throws; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see."
  },
  {
    project: "surface-callback-failing-call",
    file: "App.tsx",
    line: 12,
    operator: "callback-throw",
    anchor: "seen.push(items().map(x => JSON.parse(String(x)) as number));",
    reason:
      "The callback's JSON.parse already may throw; the Errored around the memo's read takes a failure of any class, so a second throw there changes nothing the check can see."
  }
];

/** Mark the mutants these name; throw on a stale, unmatched or ambiguous entry. */
export function markSiteEquivalents(mutants, sources) {
  for (const entry of siteEquivalents) {
    const where = `${entry.project}/${entry.file}:${entry.line} ${entry.operator}`;
    const line = sources.get(entry.project)?.get(entry.file)?.split("\n")[entry.line - 1]?.trim();
    if (line !== entry.anchor)
      throw new Error(`stale site equivalent ${where}: the line now reads ${JSON.stringify(line)}`);
    const matched = mutants.filter(
      m =>
        m.project === entry.project &&
        m.file === entry.file &&
        m.line === entry.line &&
        m.operator === entry.operator &&
        (!entry.edit || m.source.split("\n")[entry.line - 1]?.trim() === entry.edit)
    );
    if (matched.length !== 1)
      throw new Error(`site equivalent ${where} matches ${matched.length} mutants, not one`);
    matched[0].equivalent = "site: " + entry.reason;
  }
}
