/**
 * The scenarios, ported from the Solid fork's conformance harness
 * (`packages/web/test/conformance/scenarios/{blocks,rows,boundaries,events,ssr}.ts`
 * on `experiment/iterable-signals`, D-039). Each runs two sources, read from
 * `sources/`: `<name>.reference.jsx`, the fork's handwritten Solid program
 * (the oracle, unchanged apart from formatting), and `<name>.library.tsx`,
 * the same program in the library's strict dialect as it stands (call form
 * D-062, `Props<{…}>` / `Source<T, E, P>` D-068, views with no body D-032,
 * typed failures D-034, setters written through receipts D-021). The steps
 * are the fork's.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NotFound, Forbidden } from "../harness/trace.js";
import type { DriverContext, Scenario } from "../harness/types.js";
import { declared } from "./declared.js";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "sources");
const read = (file: string) => readFileSync(resolve(dir, file), "utf8");
/** Both sources of a scenario, by file stem. */
const sources = (stem: string) => ({
  reference: read(`${stem}.reference.jsx`),
  library: read(`${stem}.library.tsx`)
});

const click = (selector: string) => (ctx: DriverContext) => {
  ctx.click(selector);
  ctx.flush();
};
/** Run, flush, record the markup. */
const step = (name: string, run: (ctx: DriverContext) => void) => ({
  name,
  run: (ctx: DriverContext) => {
    run(ctx);
    ctx.flush();
    ctx.html();
  }
});

const scenario = (s: Scenario): Scenario => ({ ...s, modes: { ...declared[s.name], ...s.modes } });

export const blocksCounter = scenario({
  name: "blocks-counter",
  covers: ["component setup runs once", "memo in setup", "view reads", "event reads and writes"],
  entry: { component: "App" },
  sources: sources("blocks-counter"),
  steps: [
    { name: "initial", run: ({ html }) => html() },
    {
      name: "click",
      run: ctx => {
        click(".inc")(ctx);
        ctx.html();
      }
    },
    {
      name: "click again",
      run: ctx => {
        click(".inc")(ctx);
        ctx.html();
      }
    }
  ]
});

export const blocksEffect = scenario({
  name: "blocks-effect",
  covers: [
    "effect reads and writes",
    "effect cleanup per run and on dispose",
    "branch reads in an effect",
    "effect split (compute / effect halves)"
  ],
  entry: { component: "App" },
  sources: sources("blocks-effect"),
  steps: [
    { name: "initial", run: ({ flush, html }) => (flush(), html()) },
    {
      name: "write a = 2 (branch read of c starts)",
      run: ({ app, flush, html }) => {
        app.setA(2);
        flush();
        html();
      }
    },
    {
      name: "write flag = true",
      run: ({ app, flush }) => {
        app.setFlag(true);
        flush();
      }
    },
    {
      name: "write c = 200",
      run: ({ app, flush }) => {
        app.setC(200);
        flush();
      }
    },
    { name: "dispose", run: ({ dispose }) => dispose() }
  ]
});

export const blocksPropsChild = scenario({
  name: "blocks-props-child",
  covers: [
    "props forwarded as a source",
    "child setup runs once",
    "parent re-render does not re-create the child"
  ],
  entry: { component: "App" },
  sources: sources("blocks-props-child"),
  steps: [
    { name: "initial", run: ({ html }) => html() },
    {
      name: "write label (child re-renders)",
      run: ({ app, flush, html }) => {
        app.setLabel("b");
        flush();
        html();
      }
    },
    {
      name: "write other (parent re-renders)",
      run: ({ app, flush, html }) => {
        app.setOther(1);
        flush();
        html();
      }
    }
  ]
});

export const blocksAsyncResolve = scenario({
  name: "blocks-async-resolve",
  covers: ["async memo under Loading", "Loading / Errored call forms", "boundary nesting"],
  entry: { component: "App" },
  sources: sources("blocks-async"),
  steps: [
    { name: "initial", run: ({ html }) => html() },
    {
      name: "resolve",
      run: async ({ tasks, settle, html }) => {
        tasks.resolve("load#1", { name: "Ada" });
        await settle();
        html();
      }
    }
  ]
});

export const blocksAsyncReject = scenario({
  name: "blocks-async-reject",
  covers: ["async failure reaches Errored through Loading", "typed failure"],
  entry: { component: "App" },
  sources: sources("blocks-async"),
  steps: [
    { name: "initial", run: ({ html }) => html() },
    {
      name: "reject",
      run: async ({ tasks, settle, html }) => {
        tasks.reject("load#1", new NotFound("user 1"));
        await settle();
        html();
      }
    }
  ]
});

export const blocksAsyncEvent = scenario({
  name: "blocks-async-event",
  covers: [
    "event that waits (`yield* attempt(() => promise, onError)`)",
    "write after the wait",
    "context read through a helper generator (`yield* Ctx`, D-036)"
  ],
  entry: { component: "App" },
  sources: sources("blocks-async-event"),
  steps: [
    { name: "initial", run: ({ html }) => html() },
    {
      name: "click",
      run: ctx => {
        click(".save")(ctx);
        ctx.html();
      }
    },
    {
      name: "resolve",
      run: async ({ tasks, settle, html }) => {
        tasks.resolve("save#1", "done");
        await settle();
        html();
      }
    }
  ]
});

export const blocksRowList = scenario({
  name: "blocks-row-list",
  covers: [
    "row block: setup once per row, under the row's owner",
    "row block: each row's own state (a handler in the row writes it)",
    "row block: rows added, removed and reordered keep or drop their state",
    "row block: $cleanup when the row is removed and on dispose"
  ],
  entry: { component: "App" },
  ssr: {},
  sources: sources("blocks-row-list"),
  steps: [
    { name: "initial", run: ({ html }) => html() },
    step("toggle row b (its own state)", ctx => ctx.click(".r2")),
    step("reorder b, c, a (c is new: one setup; b keeps its state)", ctx =>
      ctx.app.setItems((list: any[]) => [list[1], { id: 3, label: "c" }, list[0]])
    ),
    step("toggle row c", ctx => ctx.click(".r3")),
    step("remove a (its cleanup runs)", ctx =>
      ctx.app.setItems((list: any[]) => list.filter((x: any) => x.label !== "a"))
    ),
    step("toggle row b again", ctx => ctx.click(".r2")),
    { name: "dispose (every row's cleanup)", run: ({ dispose }) => dispose() }
  ]
});

export const blocksRowRecursive = scenario({
  name: "blocks-row-recursive",
  covers: [
    "named row block declared in a setup",
    "recursive row block (renders itself for its children)",
    "per-instance state at every depth"
  ],
  entry: { component: "App" },
  ssr: {},
  sources: sources("blocks-row-recursive"),
  steps: [
    { name: "initial", run: ({ html }) => html() },
    step("collapse a1 (a nested instance)", ctx => ctx.click(".t2")),
    step("collapse a (the outer instance)", ctx => ctx.click(".t1")),
    step("expand a1 again", ctx => ctx.click(".t2"))
  ]
});

export const blocksRowKeyedStore = scenario({
  name: "blocks-row-keyed-store",
  covers: [
    "row block reading a store map by its own key",
    "a handler in the row writing the store at its own key"
  ],
  entry: { component: "App" },
  ssr: {},
  sources: sources("blocks-row-keyed-store"),
  steps: [
    { name: "initial", run: ({ html }) => html() },
    step("toggle row 2", ctx => ctx.click(".c2")),
    step("toggle row 1", ctx => ctx.click(".c1")),
    step("toggle row 2 back", ctx => ctx.click(".c2"))
  ]
});

export const asyncFlights = scenario({
  name: "async-flights",
  covers: [
    "async pending",
    "async resolve",
    "superseded stale flight",
    "async reject → boundary",
    "continuation ownership",
    "loading/error markers"
  ],
  entry: { component: "App" },
  sources: sources("async-flights"),
  steps: [
    { name: "pending", run: ({ html }) => html() },
    {
      name: "resolve load#1",
      run: async ({ tasks, settle, html }) => {
        tasks.resolve("load#1", "ada");
        await settle();
        html();
      }
    },
    {
      name: "id 2 then 3 (load#2 superseded)",
      run: async ({ app, flush, settle, html }) => {
        app.setId(2);
        flush();
        app.setId(3);
        flush();
        await settle();
        html();
      }
    },
    {
      name: "resolve load#3",
      run: async ({ tasks, settle, html }) => {
        tasks.resolve("load#3", "grace");
        await settle();
        html();
      }
    },
    {
      name: "resolve stale load#2 (must not commit)",
      run: async ({ tasks, settle, html }) => {
        tasks.resolve("load#2", "stale");
        await settle();
        html();
      }
    },
    {
      name: "reject load#4",
      run: async ({ app, tasks, flush, settle, html }) => {
        app.setId(4);
        flush();
        tasks.reject("load#4", new NotFound("gone"));
        await settle();
        html();
      }
    }
  ]
});

export const asyncDisposal = scenario({
  name: "async-disposal",
  covers: ["disposal before settlement", "no commit after disposal"],
  entry: { component: "App" },
  sources: sources("async-flights"),
  steps: [
    {
      name: "dispose while load#1 pending",
      run: ({ dispose }) => dispose()
    },
    {
      name: "settle after disposal",
      run: async ({ tasks, settle }) => {
        tasks.resolve("load#1", "late");
        await settle();
      }
    }
  ]
});

export const asyncEvent = scenario({
  name: "async-event",
  covers: [
    "async event pending/resolve",
    "async event reject → boundary of the creating owner",
    "writes before and after an event wait"
  ],
  entry: { component: "App" },
  sources: sources("async-event"),
  steps: [
    {
      name: "click (pending)",
      run: ({ click, flush, html }) => {
        click(".save");
        flush();
        html();
      }
    },
    {
      name: "resolve save#1",
      run: async ({ tasks, settle, html }) => {
        tasks.resolve("save#1", "saved");
        await settle();
        html();
      }
    },
    {
      name: "click, reject save#2",
      run: async ({ click, flush, tasks, settle, html }) => {
        click(".save");
        flush();
        tasks.reject("save#2", new Forbidden("denied"));
        await settle();
        html();
      }
    }
  ]
});

export const asyncHydration = scenario({
  name: "async-hydration",
  covers: [
    "SSR async resolve + Loading markers",
    "hydration reuses serialized async results (no duplicate authoritative work)",
    "post-hydration async update"
  ],
  entry: { component: "App" },
  // Flights are named by input (`user1#1`), so the same step script is valid
  // whether or not hydration re-runs the fetch.
  ssr: { resolve: { "user1#1": "ada" } },
  sources: sources("async-hydration"),
  steps: [
    {
      name: "resolve initial flight (fresh render only)",
      environments: ["client"],
      run: async ({ tasks, settle }) => {
        tasks.resolve("user1#1", "ada");
        await settle();
      }
    },
    { name: "initial", run: ({ html }) => html() },
    {
      name: "id 2",
      run: async ({ app, flush, tasks, settle, html }) => {
        app.setId(2);
        flush();
        tasks.resolve("user2#1", "grace");
        await settle();
        html();
      }
    }
  ]
});

export const scenarios: Scenario[] = [
  blocksCounter,
  blocksEffect,
  blocksPropsChild,
  blocksAsyncResolve,
  blocksAsyncReject,
  blocksAsyncEvent,
  blocksRowList,
  blocksRowRecursive,
  blocksRowKeyedStore,
  asyncFlights,
  asyncDisposal,
  asyncEvent,
  asyncHydration
];

/** The fork's scenarios this port does not carry, and why. */
export const dropped: { name: string; why: string }[] = [
  {
    name: "blocks-context",
    why: "moot under D-036: `yield* Ctx` on a library context is the one way to read one, so there is no second form to pin; blocks-async-event still reads a context, through a helper generator"
  },
  {
    name: "memo-effect-order, dynamic-subscriptions, owned-children, owner-routing, error-routing, event-reads-writes, store-paths, store-dynamic-index, prop-paths, jsx-block, error-markers",
    why: "written for the `$`-block proposal (a reference and a `$` source, no blocks source); a library source for each is a candidate for a later port"
  },
  {
    name: "tier-toggle, tier-two-cells, tier-shared, tier-diamond, islands-*",
    why: "pin the compiler's island activation and runtime tiers, which the library does not have (blocks-library.md §7)"
  }
];

export { routeFindings } from "./declared.js";
