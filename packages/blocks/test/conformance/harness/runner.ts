/**
 * Mode execution: turn (scenario, mode) into an Observation in the current
 * vitest environment. The spec for each environment passes in the
 * `solid-js` / `@solidjs/web` / `solid-blocks` namespaces its config
 * resolved, so compiled scenario code runs against exactly those builds.
 *
 * Mounting follows the source: a reference component is created as Solid
 * creates any component (`createComponent(App, {})`), a library component is
 * called (D-062) and mounted with the library's `render` / `hydrate`; on the
 * server both stream through `@solidjs/web`'s `renderToStream` (the library
 * has no server entry of its own).
 */
import { compile, evaluate } from "./module.js";
import { Recorder, controller, drain, format, probe, NotFound, Forbidden } from "./trace.js";
import type { DriverContext, ModeAdapter, Observation, Scenario } from "./types.js";

export interface Runtime {
  solid: any;
  web: any;
  blocks: any;
}

/** The server markup a hydrate mode consumes (written by the server spec). */
export interface ServerArtifact {
  /** Complete streamed output (shell + late chunks), scripts included. */
  output: string;
}

function load(scenario: Scenario, mode: ModeAdapter, runtime: Runtime, recorder: Recorder) {
  const source = scenario.sources[mode.source];
  if (source === undefined) {
    throw new Error(`[conformance] ${scenario.name} has no ${mode.source} source for ${mode.id}`);
  }
  const compiled = compile(source, mode.source, mode.compile);
  const h = probe(recorder, runtime.solid, runtime.blocks);
  const app = evaluate(compiled.code, {
    "solid-js": runtime.solid,
    "@solidjs/web": runtime.web,
    "solid-blocks": runtime.blocks,
    conformance: { h, NotFound, Forbidden }
  });
  return { app, stats: compiled.stats, code: compiled.code };
}

/**
 * A module that fails to compile or evaluate is an observation too: record
 * it instead of throwing so a scenario can pin it.
 */
function tryLoad(scenario: Scenario, mode: ModeAdapter, runtime: Runtime, recorder: Recorder) {
  try {
    return load(scenario, mode, runtime, recorder);
  } catch (error) {
    recorder.raw(`uncaught load = ${format(error)}`);
    return undefined;
  }
}

/** The root a mode mounts: a component created (reference) or called (library). */
function root(mode: ModeAdapter, runtime: Runtime, Component: any): () => unknown {
  return mode.source === "library"
    ? () => Component({})
    : () => runtime.web.createComponent(Component, {});
}

/**
 * Console output during a run is observable behaviour (dev warnings,
 * hydration mismatch reports, uncaught-error logs). Record the first line of
 * each call so traces stay stable.
 */
function captureConsole(recorder: Recorder): () => void {
  const originals = { warn: console.warn, error: console.error };
  for (const level of ["warn", "error"] as const) {
    console[level] = (...args: unknown[]) => {
      const text = args
        .map(a => (typeof a === "string" ? a : format(a)))
        .join(" ")
        .split("\n", 1)[0]
        .trim();
      recorder.raw(`console.${level} = ${text}`);
    };
  }
  return () => Object.assign(console, originals);
}

async function drive(scenario: Scenario, recorder: Recorder, ctx: DriverContext): Promise<void> {
  for (const step of scenario.steps) {
    if (step.environments && !step.environments.includes(ctx.environment)) continue;
    recorder.raw(`## ${step.name}`);
    try {
      await step.run(ctx);
    } catch (error) {
      recorder.raw(`uncaught ${step.name} = ${format(error)}`);
      recorder.raw("## aborted");
      return;
    }
  }
}

function context(
  scenario: Scenario,
  runtime: Runtime,
  recorder: Recorder,
  app: Record<string, any>,
  container: HTMLElement,
  environment: DriverContext["environment"],
  dispose: () => void
): DriverContext {
  const { solid } = runtime;
  return {
    app,
    environment,
    tasks: controller(recorder),
    flush: () => solid.flush(),
    async settle() {
      await drain();
      solid.flush();
    },
    html() {
      recorder.raw(`html = ${container.innerHTML}`);
    },
    click(selector) {
      const target = container.querySelector<HTMLElement>(selector);
      if (!target) throw new Error(`no element matches ${selector}`);
      target.click();
    },
    observe(label, value) {
      recorder.push("value", label, value);
    },
    dispose
  };
}

/**
 * Unhandled rejections during a run are observable too (an `$event` call
 * nobody awaits rejects its promise, D-033). Record them, in order.
 */
function captureRejections(recorder: Recorder): () => void {
  const onRejection = (reason: unknown) => recorder.raw(`unhandled rejection = ${format(reason)}`);
  process.on("unhandledRejection", onRejection);
  return () => void process.off("unhandledRejection", onRejection);
}

/** Client environment: fresh render. */
export async function observeClient(
  scenario: Scenario,
  mode: ModeAdapter,
  runtime: Runtime
): Promise<Observation> {
  const { solid, web, blocks } = runtime;
  const recorder = new Recorder();
  const restore = captureConsole(recorder);
  const restoreRejections = captureRejections(recorder);
  const container = document.createElement("div");
  document.body.appendChild(container);
  let disposeRoot: (() => void) | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeRoot?.();
    solid.flush();
  };
  try {
    const loaded = tryLoad(scenario, mode, runtime, recorder);
    if (!loaded) return { scenario: scenario.name, mode: mode.id, trace: recorder.events };
    const { app, stats } = loaded;
    recorder.raw("## mount");
    try {
      const code = root(mode, runtime, app[scenario.entry.component]);
      disposeRoot =
        mode.source === "library" ? blocks.render(code, container) : web.render(code, container);
      solid.flush();
    } catch (error) {
      recorder.raw(`uncaught mount = ${format(error)}`);
      return { scenario: scenario.name, mode: mode.id, trace: recorder.events, stats };
    }
    await drive(
      scenario,
      recorder,
      context(scenario, runtime, recorder, app, container, "client", dispose)
    );
    if (!disposed) {
      recorder.raw("## teardown");
      dispose();
    }
    const pending = controller(recorder).pending();
    if (pending.length) recorder.raw(`unsettled = ${pending.join(", ")}`);
    return { scenario: scenario.name, mode: mode.id, trace: recorder.events, stats };
  } finally {
    restore();
    container.remove();
    await drain();
    restoreRejections();
    // A run that halted reactivity (an uncaught computation error) must not
    // poison the next mode's run in this process.
    solid.resetErrorHalt?.();
  }
}

/**
 * Server environment: stream-render the component and record the markup,
 * hydration keys, serialized records, and the probe trace of the render.
 */
export async function observeServer(
  scenario: Scenario,
  mode: ModeAdapter,
  runtime: Runtime,
  recordKeys: (html: string) => string[]
): Promise<Observation & { artifact: ServerArtifact }> {
  const { web } = runtime;
  const recorder = new Recorder();
  const restore = captureConsole(recorder);
  try {
    const loaded = tryLoad(scenario, mode, runtime, recorder);
    if (!loaded) {
      return {
        scenario: scenario.name,
        mode: mode.id,
        trace: recorder.events,
        artifact: { output: "" }
      };
    }
    const { app, stats } = loaded;
    const code = root(mode, runtime, app[scenario.entry.component]);
    recorder.raw("## render");
    const chunks: string[] = [];
    const done = new Promise<void>((resolve, reject) => {
      try {
        web.renderToStream(code).pipe({
          write: (chunk: string) => void chunks.push(chunk),
          end: () => resolve()
        });
      } catch (error) {
        reject(error);
      }
    });
    const tasks = controller(recorder);
    let rendered = false;
    void done.then(
      () => (rendered = true),
      () => undefined
    );
    await drain();
    // Async SSR: settle each flight the render started, in start order, with
    // the value the scenario declared. Never timer-driven.
    for (const [name, value] of Object.entries(scenario.ssr?.resolve ?? {})) {
      if (rendered) break;
      try {
        if (value instanceof Error) tasks.reject(name, value);
        else tasks.resolve(name, value);
      } catch (error) {
        // e.g. the render never started the flight the scenario expects
        recorder.raw(`uncaught settle ${name} = ${format(error)}`);
        break;
      }
      await drain();
    }
    try {
      await done;
    } catch (error) {
      recorder.raw(`uncaught render = ${format(error)}`);
    }
    const output = chunks.join("");
    const markup = output.replace(/<script[\s\S]*?<\/script>/g, "");
    const keys = [...markup.matchAll(/\s_hk="?([^"\s>]+)"?/g)].map(m => m[1]);
    recorder.raw(`markup = ${markup}`);
    recorder.raw(`hydration-keys = ${JSON.stringify(keys)}`);
    recorder.raw(`serialized = ${JSON.stringify(recordKeys(output).sort())}`);
    const pending = tasks.pending();
    if (pending.length) recorder.raw(`unsettled = ${pending.join(", ")}`);
    return {
      scenario: scenario.name,
      mode: mode.id,
      trace: recorder.events,
      stats,
      artifact: { output }
    };
  } finally {
    restore();
  }
}

/**
 * Hydrate environment: apply the paired server mode's complete output (the
 * "loaded" page case), hydrate the same component compiled for the client,
 * then verify node identity and drive the scenario's steps.
 */
export async function observeHydrate(
  scenario: Scenario,
  mode: ModeAdapter,
  runtime: Runtime,
  artifact: ServerArtifact
): Promise<Observation> {
  const { solid, web, blocks } = runtime;
  const recorder = new Recorder();
  const restore = captureConsole(recorder);
  const restoreRejections = captureRejections(recorder);
  const container = document.createElement("div");
  document.body.appendChild(container);
  let disposeRoot: (() => void) | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    disposeRoot?.();
    solid.flush();
  };
  (globalThis as any)._$HY = { events: [], completed: new WeakSet(), r: {}, fe() {} };
  try {
    const loaded = tryLoad(scenario, mode, runtime, recorder);
    if (!loaded) return { scenario: scenario.name, mode: mode.id, trace: recorder.events };
    const { app, stats } = loaded;
    const scriptRe = /<script(?:[^>]*)>([\s\S]*?)<\/script>/g;
    container.innerHTML = artifact.output.replace(scriptRe, "");
    for (const [, script] of artifact.output.matchAll(scriptRe)) (0, eval)(script);
    const serverNodes = [...container.querySelectorAll("[_hk]")].map(
      node => [node.getAttribute("_hk")!, node] as const
    );
    const before = new Set(container.querySelectorAll("*"));
    recorder.raw("## hydrate");
    try {
      const code = root(mode, runtime, app[scenario.entry.component]);
      disposeRoot =
        mode.source === "library" ? blocks.hydrate(code, container) : web.hydrate(code, container);
      solid.flush();
      // hydration completes on a microtask
      await drain();
      solid.flush();
    } catch (error) {
      recorder.raw(`uncaught hydrate = ${format(error)}`);
      return { scenario: scenario.name, mode: mode.id, trace: recorder.events, stats };
    }
    // Node identity: server-keyed nodes must survive hydration, and the
    // client must not insert elements of its own. (A key miss builds a
    // detached element and leaves the server node in place, so key misses
    // show up as the runtime's console warnings and as dead updates in
    // later steps, not here.)
    const removed = serverNodes.filter(([, node]) => !node.isConnected).map(([key]) => key);
    const inserted = [...container.querySelectorAll("*")].filter(node => !before.has(node));
    recorder.raw(
      `hydration server-nodes ${serverNodes.length - removed.length}/${serverNodes.length} kept, ${inserted.length} client-inserted`
    );
    if (removed.length) recorder.raw(`hydration removed = ${JSON.stringify(removed)}`);
    await drive(
      scenario,
      recorder,
      context(scenario, runtime, recorder, app, container, "hydrate", dispose)
    );
    if (!disposed) {
      recorder.raw("## teardown");
      dispose();
    }
    const pending = controller(recorder).pending();
    if (pending.length) recorder.raw(`unsettled = ${pending.join(", ")}`);
    return { scenario: scenario.name, mode: mode.id, trace: recorder.events, stats };
  } finally {
    restore();
    await drain();
    restoreRejections();
    container.remove();
    delete (globalThis as any)._$HY;
    solid.resetErrorHalt?.();
  }
}
