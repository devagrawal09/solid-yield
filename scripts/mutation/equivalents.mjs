// Site-level equivalents (Dev's ruling, 2026-10-12): mutants read against
// their program and correct to accept, because the edited site has nothing
// left to do. The catalogue's equivalence is per operator; these are single
// sites. Each names the authored line it was read at: if that line changes,
// or the entry matches no mutant or more than one, the run fails, so a mark
// never outlives the reading behind it (sugar-design.md, "The survivors").
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
        m.operator === entry.operator
    );
    if (matched.length !== 1)
      throw new Error(`site equivalent ${where} matches ${matched.length} mutants, not one`);
    matched[0].equivalent = "site: " + entry.reason;
  }
}
