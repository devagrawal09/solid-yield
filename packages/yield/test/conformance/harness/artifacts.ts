/**
 * Server → hydrate hand-off: each server mode's complete streamed output,
 * one small committed file per (scenario, server mode). The server spec pins
 * each with `toMatchFileSnapshot` (update with `vitest -u`), so a markup or
 * hydration-key change fails the gate until it is reviewed; the hydrate spec
 * reads them.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerArtifact } from "./runner.js";

export const artifactsDir = resolve(dirname(fileURLToPath(import.meta.url)), "../__artifacts__");

export function artifactFile(scenario: string, mode: string): string {
  return resolve(artifactsDir, `${scenario}.${mode.replace("/", "-")}.html`);
}

/** The compiler route's server output, frozen from the Solid fork (see routes.spec.ts). */
export function compilerRouteFile(scenario: string): string {
  return resolve(artifactsDir, "compiler-route", `${scenario}.server-yield-compiled.html`);
}

export function readArtifact(scenario: string, mode: string): ServerArtifact {
  const path = artifactFile(scenario, mode);
  if (!existsSync(path)) {
    throw new Error(
      `[conformance] missing server artifact ${path}; run the server environment first: ` +
        "vitest run --config vite.config.conformance-server.mjs"
    );
  }
  return { output: readFileSync(path, "utf8").replace(/\n$/, "") };
}
