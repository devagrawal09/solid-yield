/**
 * Scenario and mode contracts for the semantic conformance harness. See
 * ../README.md for the architecture and how to add a scenario or a mode.
 */
import type { Recorder, controller, Probe } from "./trace.js";
import type { CompileOptions, LoweringStats } from "./module.js";

/**
 * Which authored source a mode consumes. A scenario provides one source per
 * kind; a mode whose kind is missing is "not applicable" for that scenario
 * (never silently substituted).
 *
 * - `reference`: handwritten ordinary Solid (accessor calls, plain
 *   callbacks), `scenarios/sources/<name>.reference.jsx` — the oracle.
 * - `library`: the same program in the library's strict dialect,
 *   `scenarios/sources/<name>.library.tsx` — type-checked with the package's
 *   tests and linted with `eslint-plugin-solid-blocks`' recommended rules.
 */
export type SourceKind = "reference" | "library";

/**
 * Where a mode executes. Each environment is one vitest config, because each
 * resolves `solid-js`, `@solidjs/web` and `solid-blocks` to a different build:
 *
 * - `client`: vite.config.conformance.mjs (jsdom, client builds, fresh render)
 * - `server`: vite.config.conformance-server.mjs (node, server builds, SSR)
 * - `hydrate`: vite.config.conformance-hydrate.mjs (jsdom, client builds,
 *   hydrating the markup the `server` environment recorded)
 */
export type Environment = "client" | "server" | "hydrate";

/**
 * A mode adapter: one way of turning a scenario into an observation.
 *
 * - `source` selects the scenario source (`scenario.sources[source]`).
 * - `compile` holds the exact Solid compiler options. A `library` source goes
 *   through the library route: `vite-plugin-solid-blocks`' `transform()`,
 *   then `@solidjs/compiler`'s `transform()` with these options (what the
 *   Vite plugins do), then TypeScript's type stripping.
 * - `reference` names the mode whose observation this one must reproduce
 *   (same environment, reference source). A mode with no `reference` IS an
 *   oracle and is checked against the scenario's golden trace instead.
 * - `pairedWith` (hydrate only) names the server mode whose recorded markup
 *   this mode hydrates.
 */
export interface ModeAdapter {
  id: ModeId;
  title: string;
  environment: Environment;
  source: SourceKind;
  compile: CompileOptions;
  reference?: ModeId;
  pairedWith?: ModeId;
}

export type ModeId = string;

/** Driver-side context handed to scenario steps. */
export interface DriverContext {
  /** Exports of the evaluated scenario module. */
  app: Record<string, any>;
  /** Settle controlled task flights. */
  tasks: ReturnType<typeof controller>;
  /** Explicit reactive flush point. */
  flush(): void;
  /** Drain microtasks (one zero-length macrotask turn), then flush. */
  settle(): Promise<void>;
  /** Record the container's rendered markup as an `html` event. */
  html(): void;
  /** Dispatch a click on the first element matching `selector`. */
  click(selector: string): void;
  /** Record an observed value directly from the driver. */
  observe(label: string, value: unknown): void;
  /** Dispose the mounted root (its cleanups are traced). */
  dispose(): void;
  environment: Environment;
}

export interface Step {
  name: string;
  run(ctx: DriverContext): void | Promise<void>;
  /**
   * Environments the step runs in (default: all that drive steps). E.g. a
   * client render must settle the initial flight itself, while hydration
   * starts from the server's resolved value.
   */
  environments?: Environment[];
}

/**
 * The per-mode expectation. The default for every mode is `equivalent`: its
 * trace must equal its reference mode's trace exactly. Anything else is
 * declared per scenario with a reason:
 *
 * - `differs`: an intentional, reviewed semantic difference; the mode must
 *   produce exactly the declared trace — either spelled out in full
 *   (`trace`) or as exact edits of the reference trace (`remove` lines that
 *   must each exist, `insert` lines after an exact anchor line). Never a
 *   normalization: every differing event is enumerated.
 * - `known-defect`: a defect isolated by this scenario; the mode must still
 *   DIVERGE from its reference (so a fix is noticed and the entry is flipped
 *   to `equivalent`). `firstDivergence` pins the first diverging event.
 * - `not-applicable`: the scenario cannot be expressed in this mode; the
 *   mode is not run.
 */
export type ModeExpectation =
  | { status: "equivalent" }
  | ({ status: "differs"; reason: string } & (
      | { trace: string[] }
      | { remove?: string[]; insert?: { after: string; lines: string[] }[] }
    ))
  | { status: "known-defect"; reason: string; firstDivergence?: string }
  | { status: "not-applicable"; reason: string };

export interface Scenario {
  name: string;
  /** Semantic areas this scenario covers (reported in the matrix). */
  covers: string[];
  sources: Partial<Record<SourceKind, string>>;
  /** What to mount: `app[component]`, rendered into a container (and, with `ssr`, server-rendered and hydrated). */
  entry: { component: string };
  /** Participates in the server and hydrate environments. */
  ssr?: {
    /**
     * Controlled flights the server render starts, settled in this order
     * (an `Error` value rejects). The server always stream-renders; this is
     * how an async render completes without timers.
     */
    resolve?: Record<string, unknown>;
  };
  /** Steps driven after mounting, in client and hydrate environments. */
  steps: Step[];
  /** Per-mode expectations; unlisted modes must be equivalent. */
  modes?: Record<ModeId, ModeExpectation>;
}

/** What one mode observed for one scenario. */
export interface Observation {
  scenario: string;
  mode: ModeId;
  trace: string[];
  stats?: LoweringStats;
}

export type { Recorder, Probe };
