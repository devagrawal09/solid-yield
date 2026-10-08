import { readFileSync, writeFileSync, renameSync, appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { writeHeapSnapshot } from "node:v8";
import { cleanupSample } from "./sample-cleanup.mjs";
import { setTimeout as sleep } from "node:timers/promises";
// This module is imported before the authored script installs fake clocks.
const realNow = performance.now.bind(performance);
const env = process.env;
function write(path, data) {
  writeFileSync(path + ".tmp", JSON.stringify(data));
  renameSync(path + ".tmp", path);
}
function nodeCount() {
  const walker = document.createTreeWalker(document);
  let count = 0;
  while (walker.nextNode()) count++;
  return count;
}
export async function session(script, mount, cleanup) {
  const errors = [];
  let errorCount = 0;
  let round = 0,
    currentStep = "mount";
  const capture = error => {
    const message = String(error?.stack ?? error?.message ?? error);
    errorCount++;
    // Avoid retaining Error objects and bound owners; keep only the first 20 diagnostics.
    if (errors.length < 20) errors.push({ round, step: currentStep, message });
    appendFileSync(env.SOAK_ERRORS, JSON.stringify({ round, step: currentStep, message }) + "\n");
  };
  const rejection = reason => capture(reason);
  const browserError = event => capture(event.error ?? event.message ?? event.reason);
  const originalError = console.error;
  const originalPush = history.pushState;
  // Diagnostic control only: preserve navigation URLs without appending jsdom history.
  if (env.SOAK_REPLACE_HISTORY === "1")
    history.pushState = (state, title, url) => history.replaceState(state, title, url);
  console.error = (...args) => {
    capture(args.join(" "));
  };
  process.on("unhandledRejection", rejection);
  process.on("uncaughtExceptionMonitor", capture);
  window.addEventListener("error", browserError);
  window.addEventListener("unhandledrejection", browserError);
  let app;
  const snapshot = () => {
    let html = script.snapshot
      ? script.snapshot(app)
      : (app?.root ?? script.root?.() ?? document.body).innerHTML;
    if (env.SOAK_TWIN.startsWith("rendering"))
      html = document.body.innerHTML.replace(/ (for|id)="[0-9a-z-]+"/g, ' $1="#id"');
    // Same hydration-only normalization as parity. HN also compares URL; room includes draft.
    html = html
      .replace(/\s(data-hk|_hk)="[^"]*"/g, "")
      .replace(/\s_hk=[^\s>]*/g, "")
      .replace(/<!--[\s\S]*?-->/g, "");
    if (env.SOAK_TWIN.startsWith("hackernews"))
      html = `${location.pathname}${location.search}\n${html}`;
    return html;
  };
  const execute = async id => {
    currentStep = typeof id === "number" ? script.steps[id][0] : id;
    if (env.SOAK_APP === "control") return;
    if (typeof id === "number") return script.steps[id][1](app);
    if (id === "todos-start") {
      script.setRandom(0.9);
      script.hash("#/");
      while (script.$$("li.todo").length < 3) {
        script.type("write the linker");
        await script.settle();
      }
    } else if (id === "todos-end") {
      // Keep authored data bounded so growth is not an ever-growing application list.
      await script.steps[21][1]();
      await script.steps[22][1]();
      if (script.$("button.clear-completed")) {
        await script.steps[23][1]();
        await script.steps[24][1]();
      }
      if (script.$("button.destroy")) {
        await script.steps[25][1]();
        await script.steps[26][1]();
      }
      script.setRandom(0.9);
      while (script.$("button.destroy")) {
        script.click(script.$("button.destroy"));
        await script.settle();
      }
    } else if (id === "docs-home") {
      document
        .querySelector('a[href="/"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      await script.steps[5][1]();
    } else if (id === "room-switch") {
      const room = location.search.includes("infra") ? "design" : "infra";
      await script.click(app, `.directory a[href="/live?room=${room}"]`);
    }
  };
  try {
    app = await mount();
    // Authored initial settling; persistent app, clock and jsdom throughout all rounds.
    if (env.SOAK_TWIN.startsWith("room")) for (let i = 0; i < 4; i++) await execute(i);
    else if (env.SOAK_TWIN.startsWith("hackernews") || env.SOAK_TWIN.startsWith("rendering"))
      await execute(0);
    else if (env.SOAK_TWIN.startsWith("todos")) {
      await execute(0);
      await execute(1);
    }
    write(env.SOAK_REPLY, { ready: true, debug: Boolean(globalThis.__yieldSoakCounts) });
    let last = 0;
    for (;;) {
      let command;
      try {
        command = JSON.parse(readFileSync(env.SOAK_COMMAND, "utf8"));
      } catch {}
      if (!command || command.id === last) {
        await sleep(10);
        continue;
      }
      last = command.id;
      if (command.stop) break;
      round = command.id;
      const hashes = [],
        stepFailures = [];
      for (const id of command.steps) {
        try {
          await execute(id);
        } catch (error) {
          stepFailures.push({ step: currentStep, message: String(error?.stack ?? error) });
          break;
        }
        if (command.checkpoint)
          hashes.push({
            step: currentStep,
            hash: createHash("sha256").update(snapshot()).digest("hex"),
            html: command.keepHtml ? snapshot() : undefined
          });
      }
      // Let settled promises report rejections before the sample; use real Node timer.
      await sleep(0);
      if (typeof globalThis.gc !== "function") throw new Error("soak requires exposed GC");
      // Call/settled-result records and old navigation entries belong to the driver,
      // not the app. Opt out only when reproducing an older report.
      cleanupSample(window, globalThis.vi, env);
      globalThis.gc();
      const counts = globalThis.__yieldSoakCounts ?? {
        roots: 0,
        boundaries: 0,
        routines: 0,
        pendingPromises: 0,
        eventsInFlight: 0,
        eventQueueDepth: 0
      };
      const sample = {
        round,
        timeMs: realNow(),
        heap: process.memoryUsage().heapUsed,
        domNodes: nodeCount(),
        mockRandomCalls: Math.random.mock?.calls?.length ?? 0,
        historyEntries: window.history.length,
        ...counts
      };
      appendFileSync(env.SOAK_SAMPLES, JSON.stringify(sample) + "\n");
      if (env.SOAK_SNAPSHOT_ROUNDS?.split(",").map(Number).includes(round))
        writeHeapSnapshot(`${env.SOAK_SAMPLES}-round-${round}.heapsnapshot`);
      write(env.SOAK_REPLY, { round, sample, hashes, stepFailures, errors, errorCount });
    }
  } catch (error) {
    capture(error);
    write(env.SOAK_REPLY, { fatal: String(error?.stack ?? error), round });
    throw error;
  } finally {
    app?.dispose?.();
    await cleanup?.();
    console.error = originalError;
    history.pushState = originalPush;
    process.removeListener("unhandledRejection", rejection);
    process.removeListener("uncaughtExceptionMonitor", capture);
    window.removeEventListener("error", browserError);
    window.removeEventListener("unhandledrejection", browserError);
    globalThis.gc?.();
    write(env.SOAK_REPLY, {
      stopped: true,
      countsAfterDispose: {
        ...globalThis.__yieldSoakCounts,
        heap: process.memoryUsage().heapUsed,
        domNodes: nodeCount()
      }
    });
  }
}
