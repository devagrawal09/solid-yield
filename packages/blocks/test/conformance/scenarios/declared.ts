/**
 * Declared differences of the library route from the oracle, per scenario
 * and mode, each with its reason; and the findings from comparing the
 * library route's server output with the compiler route's. Every entry is a
 * finding recorded in documentation/DECISIONS.md (D-069; F2–F5 here, F6 in `routeFindings`; F1 resolved by D-079).
 */
import type { ModeExpectation } from "../harness/types.js";

export const declared: Record<string, Record<string, ModeExpectation>> = {
  "blocks-row-list": {
    "client/library": {
      status: "differs",
      reason:
        "F2: a row's view is rendered once per row, and each hole is its own computation, so a list update re-renders no row view: the reference's row callback returns a thunk that the list's insert calls again on every update (each row re-reads its `open`; the islands mode of the fork matched the library here). At mount a row's view is built right after its setup (setup a, view a, setup b, view b), where the reference sets every row up before rendering. Every write, run, cleanup and markup is the oracle's.",
      trace: [
        "## mount",
        'read items = [{"id":1,"label":"a"},{"id":2,"label":"b"}]',
        "run setup a",
        "read open a = true",
        "run setup b",
        "read open b = true",
        "## initial",
        'html = <ul><li class="row r1">a=open<!----></li><li class="row r2">b=open<!----></li></ul>',
        "## toggle row b (its own state)",
        "run toggle b",
        "read open b = true",
        "write open b = false",
        "read open b = false",
        'html = <ul><li class="row r1">a=open<!----></li><li class="row r2">b=closed<!----></li></ul>',
        "## reorder b, c, a (c is new: one setup; b keeps its state)",
        'write items = [{"id":2,"label":"b"},{"id":3,"label":"c"},{"id":1,"label":"a"}]',
        'read items = [{"id":2,"label":"b"},{"id":3,"label":"c"},{"id":1,"label":"a"}]',
        "run setup c",
        "read open c = true",
        'html = <ul><li class="row r2">b=closed<!----></li><li class="row r3">c=open<!----></li><li class="row r1">a=open<!----></li></ul>',
        "## toggle row c",
        "run toggle c",
        "read open c = true",
        "write open c = false",
        "read open c = false",
        'html = <ul><li class="row r2">b=closed<!----></li><li class="row r3">c=closed<!----></li><li class="row r1">a=open<!----></li></ul>',
        "## remove a (its cleanup runs)",
        'write items = [{"id":2,"label":"b"},{"id":3,"label":"c"}]',
        'read items = [{"id":2,"label":"b"},{"id":3,"label":"c"}]',
        "run cleanup a",
        'html = <ul><li class="row r2">b=closed<!----></li><li class="row r3">c=closed<!----></li></ul>',
        "## toggle row b again",
        "run toggle b",
        "read open b = false",
        "write open b = true",
        "read open b = true",
        'html = <ul><li class="row r2">b=open<!----></li><li class="row r3">c=closed<!----></li></ul>',
        "## dispose (every row's cleanup)",
        "run cleanup c",
        "run cleanup b"
      ]
    },
    "server/library": {
      status: "differs",
      reason:
        "F5: hydration keys only, plus F2's row order: the markup is the oracle's with other `_hk` values. Each `{yield* …}` hole is a computation, and a flow control called in one adds its own owner, so the library numbers a row's nodes two levels below the list (`1000`, `1010`) where the handwritten oracle numbers them in its component's sequence (`3`, `5`). Each row's view is rendered right after its setup.",
      trace: [
        "## render",
        'read items = [{"id":1,"label":"a"},{"id":2,"label":"b"}]',
        "run setup a",
        "read open a = true",
        "run setup b",
        "read open b = true",
        "run cleanup b",
        "run cleanup a",
        'markup = <ul _hk=0><li _hk=1000 class="row r1"><!--$-->a<!--/-->=<!--$-->open<!--/--></li><li _hk=1010 class="row r2"><!--$-->b<!--/-->=<!--$-->open<!--/--></li></ul>',
        'hydration-keys = ["0","1000","1010"]',
        "serialized = []"
      ]
    },
    "hydrate/library": {
      status: "differs",
      reason:
        "F5 + F2: hydrating `server/library`'s markup claims every server node (3/3 kept, none inserted), with the library's `_hk` values in the `html` lines; a list update re-renders no row (the reordered rows keep their server nodes and keys, where the oracle re-creates every row's element).",
      trace: [
        "## hydrate",
        'read items = [{"id":1,"label":"a"},{"id":2,"label":"b"}]',
        "run setup a",
        "read open a = true",
        "run setup b",
        "read open b = true",
        "hydration server-nodes 3/3 kept, 0 client-inserted",
        "## initial",
        'html = <ul _hk="0"><li _hk="1000" class="row r1"><!--$-->a<!--/-->=<!--$-->open<!--/--></li><li _hk="1010" class="row r2"><!--$-->b<!--/-->=<!--$-->open<!--/--></li></ul>',
        "## toggle row b (its own state)",
        "run toggle b",
        "read open b = true",
        "write open b = false",
        "read open b = false",
        'html = <ul _hk="0"><li _hk="1000" class="row r1"><!--$-->a<!--/-->=<!--$-->open<!--/--></li><li _hk="1010" class="row r2"><!--$-->b<!--/-->=<!--$-->closed<!--/--></li></ul>',
        "## reorder b, c, a (c is new: one setup; b keeps its state)",
        'write items = [{"id":2,"label":"b"},{"id":3,"label":"c"},{"id":1,"label":"a"}]',
        'read items = [{"id":2,"label":"b"},{"id":3,"label":"c"},{"id":1,"label":"a"}]',
        "run setup c",
        "read open c = true",
        'html = <ul _hk="0"><li _hk="1010" class="row r2"><!--$-->b<!--/-->=<!--$-->closed<!--/--></li><li class="row r3"><!--$-->c<!--/-->=<!--$-->open<!--/--></li><li _hk="1000" class="row r1"><!--$-->a<!--/-->=<!--$-->open<!--/--></li></ul>',
        "## toggle row c",
        "run toggle c",
        "read open c = true",
        "write open c = false",
        "read open c = false",
        'html = <ul _hk="0"><li _hk="1010" class="row r2"><!--$-->b<!--/-->=<!--$-->closed<!--/--></li><li class="row r3"><!--$-->c<!--/-->=<!--$-->closed<!--/--></li><li _hk="1000" class="row r1"><!--$-->a<!--/-->=<!--$-->open<!--/--></li></ul>',
        "## remove a (its cleanup runs)",
        'write items = [{"id":2,"label":"b"},{"id":3,"label":"c"}]',
        'read items = [{"id":2,"label":"b"},{"id":3,"label":"c"}]',
        "run cleanup a",
        'html = <ul _hk="0"><li _hk="1010" class="row r2"><!--$-->b<!--/-->=<!--$-->closed<!--/--></li><li class="row r3"><!--$-->c<!--/-->=<!--$-->closed<!--/--></li></ul>',
        "## toggle row b again",
        "run toggle b",
        "read open b = false",
        "write open b = true",
        "read open b = true",
        'html = <ul _hk="0"><li _hk="1010" class="row r2"><!--$-->b<!--/-->=<!--$-->open<!--/--></li><li class="row r3"><!--$-->c<!--/-->=<!--$-->closed<!--/--></li></ul>',
        "## dispose (every row's cleanup)",
        "run cleanup c",
        "run cleanup b"
      ]
    }
  },
  "blocks-row-recursive": {
    "server/library": {
      status: "differs",
      reason:
        "F5: hydration keys only: the markup is the oracle's; every level of nesting adds the hole's and the flow control's owners (`100222000` where the oracle has `74`).",
      trace: [
        "## render",
        "read open a = true",
        "read open a = true",
        "read open a1 = true",
        "read open a1 = true",
        'markup = <ul _hk=0 class="tree"><li _hk=1000 class="n1"><span>a</span><!--$--><a _hk=100220 class="t1">[-]</a><ul _hk=100221 style="display:block"><li _hk=100222000 class="n2"><span>a1</span><!--$--><a _hk=10022200220 class="t2">[-]</a><ul _hk=10022200221 style="display:block"><li _hk=10022200222000 class="n3"><span>a1x</span><!--$--><!--/--></li></ul><!--/--></li></ul><!--/--></li><li _hk=1010 class="n4"><span>b</span><!--$--><!--/--></li></ul>',
        'hydration-keys = ["0","1000","100220","100221","100222000","10022200220","10022200221","10022200222000","1010"]',
        "serialized = []"
      ]
    },
    "hydrate/library": {
      status: "differs",
      reason:
        "F5: hydrating `server/library`'s markup claims every server node (9/9 kept, none inserted); the `html` lines show the library's `_hk` values. Every read, write and later render is the oracle's.",
      trace: [
        "## hydrate",
        "read open a = true",
        "read open a1 = true",
        "read open a1 = true",
        "read open a = true",
        "hydration server-nodes 9/9 kept, 0 client-inserted",
        "## initial",
        'html = <ul _hk="0" class="tree"><li _hk="1000" class="n1"><span>a</span><!--$--><a _hk="100220" class="t1">[-]</a><ul _hk="100221" style="display:block"><li _hk="100222000" class="n2"><span>a1</span><!--$--><a _hk="10022200220" class="t2">[-]</a><ul _hk="10022200221" style="display:block"><li _hk="10022200222000" class="n3"><span>a1x</span><!--$--><!--/--></li></ul><!--/--></li></ul><!--/--></li><li _hk="1010" class="n4"><span>b</span><!--$--><!--/--></li></ul>',
        "## collapse a1 (a nested instance)",
        "read open a1 = true",
        "write open a1 = false",
        "read open a1 = false",
        "read open a1 = false",
        'html = <ul _hk="0" class="tree"><li _hk="1000" class="n1"><span>a</span><!--$--><a _hk="100220" class="t1">[-]</a><ul _hk="100221" style="display:block"><li _hk="100222000" class="n2"><span>a1</span><!--$--><a _hk="10022200220" class="t2">[+]</a><ul _hk="10022200221" style="display: none;"><li _hk="10022200222000" class="n3"><span>a1x</span><!--$--><!--/--></li></ul><!--/--></li></ul><!--/--></li><li _hk="1010" class="n4"><span>b</span><!--$--><!--/--></li></ul>',
        "## collapse a (the outer instance)",
        "read open a = true",
        "write open a = false",
        "read open a = false",
        "read open a = false",
        'html = <ul _hk="0" class="tree"><li _hk="1000" class="n1"><span>a</span><!--$--><a _hk="100220" class="t1">[+]</a><ul _hk="100221" style="display: none;"><li _hk="100222000" class="n2"><span>a1</span><!--$--><a _hk="10022200220" class="t2">[+]</a><ul _hk="10022200221" style="display: none;"><li _hk="10022200222000" class="n3"><span>a1x</span><!--$--><!--/--></li></ul><!--/--></li></ul><!--/--></li><li _hk="1010" class="n4"><span>b</span><!--$--><!--/--></li></ul>',
        "## expand a1 again",
        "read open a1 = false",
        "write open a1 = true",
        "read open a1 = true",
        "read open a1 = true",
        'html = <ul _hk="0" class="tree"><li _hk="1000" class="n1"><span>a</span><!--$--><a _hk="100220" class="t1">[+]</a><ul _hk="100221" style="display: none;"><li _hk="100222000" class="n2"><span>a1</span><!--$--><a _hk="10022200220" class="t2">[-]</a><ul _hk="10022200221" style="display: block;"><li _hk="10022200222000" class="n3"><span>a1x</span><!--$--><!--/--></li></ul><!--/--></li></ul><!--/--></li><li _hk="1010" class="n4"><span>b</span><!--$--><!--/--></li></ul>',
        "## teardown"
      ]
    }
  },
  "blocks-row-keyed-store": {
    "server/library": {
      status: "differs",
      reason:
        "F5: hydration keys only: the markup is the oracle's with the library's `_hk` values (`1000`, `1010`, `1020` for `3`, `5`, `7`).",
      trace: [
        "## render",
        'markup = <ul _hk=0><li _hk=1000 class="c1"><!--$-->a<!--/-->:<!--$-->open<!--/--></li><li _hk=1010 class="c2"><!--$-->b<!--/-->:<!--$-->open<!--/--></li><li _hk=1020 class="c3"><!--$-->c<!--/-->:<!--$-->open<!--/--></li></ul>',
        'hydration-keys = ["0","1000","1010","1020"]',
        "serialized = []"
      ]
    },
    "hydrate/library": {
      status: "differs",
      reason:
        "F5: hydrating `server/library`'s markup claims every server node (4/4 kept, none inserted); the `html` lines show the library's `_hk` values. Every run is the oracle's.",
      trace: [
        "## hydrate",
        "hydration server-nodes 4/4 kept, 0 client-inserted",
        "## initial",
        'html = <ul _hk="0"><li _hk="1000" class="c1"><!--$-->a<!--/-->:<!--$-->open<!--/--></li><li _hk="1010" class="c2"><!--$-->b<!--/-->:<!--$-->open<!--/--></li><li _hk="1020" class="c3"><!--$-->c<!--/-->:<!--$-->open<!--/--></li></ul>',
        "## toggle row 2",
        "run toggle 2",
        'html = <ul _hk="0"><li _hk="1000" class="c1"><!--$-->a<!--/-->:<!--$-->open<!--/--></li><li _hk="1010" class="c2"><!--$-->b<!--/-->:<!--$-->closed<!--/--></li><li _hk="1020" class="c3"><!--$-->c<!--/-->:<!--$-->open<!--/--></li></ul>',
        "## toggle row 1",
        "run toggle 1",
        'html = <ul _hk="0"><li _hk="1000" class="c1"><!--$-->a<!--/-->:<!--$-->closed<!--/--></li><li _hk="1010" class="c2"><!--$-->b<!--/-->:<!--$-->closed<!--/--></li><li _hk="1020" class="c3"><!--$-->c<!--/-->:<!--$-->open<!--/--></li></ul>',
        "## toggle row 2 back",
        "run toggle 2",
        'html = <ul _hk="0"><li _hk="1000" class="c1"><!--$-->a<!--/-->:<!--$-->closed<!--/--></li><li _hk="1010" class="c2"><!--$-->b<!--/-->:<!--$-->open<!--/--></li><li _hk="1020" class="c3"><!--$-->c<!--/-->:<!--$-->open<!--/--></li></ul>',
        "## teardown"
      ]
    }
  },
  "async-flights": {
    "client/library": {
      status: "differs",
      reason:
        "F3: a superseded `$memo` run is closed at its pending `attempt` (its generator is returned), where an async function continues after `await` and its result is discarded: `owner after wait(2)` is not logged (as the fork's `$` modes). A run disposed with its owner is not closed: async-disposal is equivalent.",
      trace: [
        "## mount",
        "read id = 1",
        "run user(1)",
        "owner before wait(1) = user memo",
        "task load#1 = 1",
        "## pending",
        'html = <p class="loading">loading</p>',
        "## resolve load#1",
        'settle load#1 = "ada"',
        "owner after wait(1) = none",
        'html = <p class="user">ada</p>',
        "## id 2 then 3 (load#2 superseded)",
        "write id = 2",
        "read id = 2",
        "run user(2)",
        "owner before wait(2) = user memo",
        "task load#2 = 2",
        "write id = 3",
        "read id = 3",
        "run user(3)",
        "owner before wait(3) = user memo",
        "task load#3 = 3",
        'html = <p class="user">ada</p>',
        "## resolve load#3",
        'settle load#3 = "grace"',
        "owner after wait(3) = none",
        'html = <p class="user">grace</p>',
        "## resolve stale load#2 (must not commit)",
        'settle load#2 = "stale"',
        'html = <p class="user">grace</p>',
        "## reject load#4",
        "write id = 4",
        "read id = 4",
        "run user(4)",
        "owner before wait(4) = user memo",
        "task load#4 = 4",
        "reject load#4 = NotFound(gone)",
        "caught boundary = NotFound(gone)",
        'html = <p class="err">NotFound</p>',
        "## teardown"
      ]
    }
  },
  "async-event": {
    "client/library": {
      status: "differs",
      reason:
        "F4 (D-020): an `$event` call is one transaction, so the write before its wait (`saving`) is held until the call settles: the hole re-reads it, the DOM keeps `idle`. The reference writes through at once. Showing a write while an event waits is `$optimistic`'s job; every other event is the oracle's, the rejection reaching the Errored above the event's owner included.",
      trace: [
        "## mount",
        'read status = "idle"',
        "## click (pending)",
        "run save",
        'write status = "saving"',
        "task save#1",
        'read status = "saving"',
        'html = <button class="save">idle</button>',
        "## resolve save#1",
        'settle save#1 = "saved"',
        'write status = "saved"',
        'read status = "saved"',
        'html = <button class="save">saved</button>',
        "## click, reject save#2",
        "run save",
        'write status = "saving"',
        "task save#2",
        'read status = "saving"',
        "reject save#2 = Forbidden(denied)",
        "caught boundary = Forbidden(denied)",
        'html = <p class="err">Forbidden</p>',
        "## teardown"
      ]
    }
  },
  "async-hydration": {
    "server/library": {
      status: "differs",
      reason:
        "F5: hydration keys only: the `Loading` is called in a hole, one owner deeper than the oracle's tag, so its keys, its placeholder and its serialized record carry one more digit (`20` → `200`, `2_fr` → `20_fr`). Reads, runs, the resolved flight and the markup are the oracle's.",
      trace: [
        "## render",
        "read id = 1",
        "run user(1)",
        "task user1#1",
        'settle user1#1 = "ada"',
        'markup = <section _hk=1><template id="pl-20"></template><p _hk=200 class="loading">loading</p><!--pl-20--></section><template id="20"><p _hk=20000 class="user">ada</p></template>',
        'hydration-keys = ["1","200","20000"]',
        'serialized = ["0","20_fr"]'
      ]
    },
    "hydrate/library": {
      status: "differs",
      reason:
        "F5: hydrating `server/library`'s markup claims every server node (2/2 kept) and re-runs the memo as the oracle does; the `html` lines show the library's `_hk` value (`20000`).",
      trace: [
        "## hydrate",
        "read id = 1",
        "run user(1)",
        "task user1#1",
        "hydration server-nodes 2/2 kept, 0 client-inserted",
        "## initial",
        'html = <section _hk="1"><p _hk="20000" class="user">ada</p></section>',
        "## id 2",
        "write id = 2",
        "read id = 2",
        "run user(2)",
        "task user2#1",
        'settle user2#1 = "grace"',
        'html = <section _hk="1"><p _hk="20000" class="user">grace</p></section>',
        "## teardown",
        "unsettled = user1#1"
      ]
    }
  }
};

/**
 * The library route's server output against the compiler route's (the fork's
 * `server/blocks-compiled`, frozen under `__artifacts__/compiler-route/`).
 * routes.spec.ts checks each difference is exactly what is declared here:
 * the two key lists, and the markup each route emits that the other does not.
 */
export interface RouteFinding {
  scenario: string;
  decision: string;
  summary: string;
  /** `_hk` values in document order, each route. */
  compilerKeys: string[];
  libraryKeys: string[];
  /** Markup only the compiler route emits, with its number of occurrences. */
  compilerOnly: Record<string, number>;
}

const SEPARATOR =
  "`<!--!$-->` between rows is in the compiler route's output only; rc.13's own reference does not emit it either (the fork's Solid did), so it is Solid's drift, not the route's.";
const KEYS =
  "The markup is the same; the hydration keys are not. The compiler route makes each `$component` view and row view a hydration id scope (`blockScope`: one slot reserved where the block is created, its content numbered inside: `00`, `01000`, `01100`); the library route has Solid's owner ids, where each hole and each flow control called in one is an owner (`0`, `1000`, `1010`). Each route hydrates its own markup with every node kept, and the two are not interchangeable: the library client given the compiler route's markup misses every key, the root's included, and the page stays inert (hydrate-self-test.spec.ts; the reverse needs the blocks compiler, which is not here).";

export const routeFindings: RouteFinding[] = [
  {
    scenario: "blocks-row-list",
    decision: "D-069 F6",
    summary: `${KEYS} ${SEPARATOR}`,
    compilerKeys: ["00", "01000", "01100"],
    libraryKeys: ["0", "1000", "1010"],
    compilerOnly: { "<!--!$-->": 1 }
  },
  {
    scenario: "blocks-row-recursive",
    decision: "D-069 F6",
    summary: `${KEYS} Nested rows: the compiler route adds 3 digits per level of rows (\`0100320032000\` at depth 3), the library route 5 (\`10022200222000\`). ${SEPARATOR}`,
    compilerKeys: [
      "00",
      "01000",
      "010030",
      "010031",
      "010032000",
      "0100320030",
      "0100320031",
      "0100320032000",
      "01100"
    ],
    libraryKeys: [
      "0",
      "1000",
      "100220",
      "100221",
      "100222000",
      "10022200220",
      "10022200221",
      "10022200222000",
      "1010"
    ],
    compilerOnly: { "<!--!$-->": 1 }
  },
  {
    scenario: "blocks-row-keyed-store",
    decision: "D-069 F6",
    summary: `${KEYS} ${SEPARATOR}`,
    compilerKeys: ["00", "01000", "01100", "01200"],
    libraryKeys: ["0", "1000", "1010", "1020"],
    compilerOnly: { "<!--!$-->": 2 }
  }
];
