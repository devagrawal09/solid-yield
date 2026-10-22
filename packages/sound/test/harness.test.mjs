// @ts-check
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { fixtures, fixturesDir, byGroup } from "../fixtures/index.mjs";
import { deriveSources } from "../fixtures/extract.mjs";
import { CODES, BY_CODE } from "../src/codes.mjs";
import { score } from "../harness/score.mjs";
import { createCheckerFor, loadPrototypes } from "../harness/load.mjs";
import { nullPrototype } from "../harness/null-prototype.mjs";
import { assertKnownOpenclaw } from "../harness/openclaw-known.mjs";
import { assertKnownPrecision } from "../harness/openclaw-precision-known.mjs";

const require = createRequire(import.meta.url);
// solid-js's package exports do not expose diagnostics.json; read it from the resolved package directory.
const solidPackage = resolve(require.resolve("solid-js/package.json"), "..");
/** @type {{ code: string, kind: string[], severity: string[] }[]} */
const runtimeCatalog = JSON.parse(readFileSync(resolve(solidPackage, "diagnostics.json"), "utf8"));
const REFERENCE_APP = "/private/var/folders/k4/g2_9q0g52437sbcp5m856r6m0000gn/T/ocpp/native-provider-read-final-consumers.6vRfcF/equipment-checkout/src";

describe("the shared fixture slice", () => {
  it("has every file, and every expected code is in the shared table", () => {
    for (const fx of fixtures) {
      for (const f of fx.files) expect(existsSync(resolve(fixturesDir, fx.dir, f)), `${fx.id}: ${f}`).toBe(true);
      for (const e of [...fx.expected, ...(fx.expectedWarnings ?? []), ...(fx.expectedInfo ?? [])]) expect(BY_CODE[e.code], `${fx.id}: ${e.code}`).toBeDefined();
    }
    expect(byGroup("cases").length).toBeGreaterThanOrEqual(50);
    expect(byGroup("mutants").length).toBeGreaterThanOrEqual(13);
  });

  it("copies the cases byte-identically from their origins", async () => {
    const sources = await deriveSources();
    for (const fx of byGroup("cases")) {
      const onDisk = readFileSync(resolve(fixturesDir, fx.dir, fx.files[0]), "utf8");
      expect(onDisk, fx.id).toBe(sources.get(fx.id));
    }
  });

  it("copies the Equipment Checkout sources byte-identically (when the reference app is present)", () => {
    if (!existsSync(REFERENCE_APP)) return;
    const eq = fixtures.find(f => f.id === "equipment-checkout");
    if (!eq) throw new Error("no equipment fixture");
    for (const f of eq.files.filter(f => f.startsWith("src/"))) {
      expect(readFileSync(resolve(fixturesDir, eq.dir, f), "utf8"), f).toBe(readFileSync(resolve(REFERENCE_APP, f.slice(4)), "utf8"));
    }
  });
});

describe("the shared code table", () => {
  it("reuses Solid's runtime codes with the runtime's kind and documents the runtime severity", () => {
    for (const entry of CODES) {
      if (!entry.runtime || entry.runtime.code !== entry.code) continue;
      const runtime = runtimeCatalog.find(d => d.code === entry.code);
      expect(runtime, entry.code).toBeDefined();
      expect(runtime?.kind, entry.code).toContain(entry.kind);
      expect(runtime?.severity, entry.code).toContain(entry.runtime.severity);
      // Static proof is an error even when rc.17 only warns (D-130).
      expect(entry.severity, entry.code).toBe(
        ["STRICT_READ_UNTRACKED", "ASYNC_OUTSIDE_LOADING_BOUNDARY", "PENDING_ASYNC_FORBIDDEN_SCOPE"].includes(entry.code)
          ? "error" : entry.runtime.severity
      );
    }
  });
  it("keeps partial-check and pending-handler findings as warnings", () => {
    for (const code of ["UNANALYZED_BOUNDARY", "PENDING_ASYNC_IN_HANDLER"]) {
      expect(CODES.find(entry => entry.code === code)?.severity, code).toBe("warn");
    }
  });
  it("invents no code that collides with a runtime code of a different meaning", () => {
    for (const entry of CODES) {
      if (entry.runtime?.code === entry.code) continue;
      expect(runtimeCatalog.some(d => d.code === entry.code), entry.code).toBe(false);
    }
  });
});

describe("the harness", () => {
  it("runs B and C by default and keeps retired A available explicitly (D-132)", async () => {
    const active = await loadPrototypes("all");
    expect(active.missing).toEqual([]);
    expect(active.prototypes.map(prototype => prototype.name)).toEqual(["dataflow", "oxc"]);
    const retired = await loadPrototypes("typed");
    expect(retired.missing).toEqual([]);
    expect(retired.prototypes.map(prototype => prototype.name)).toEqual(["typed"]);
  });
  it("flags every in-subset expectation as a soundness failure against the null prototype", () => {
    for (const fx of fixtures) {
      const s = score(fx, fixturesDir, [], 0);
      expect(s.soundnessFailure).toBe(fx.inSubset && (fx.expected.length > 0 || (fx.expectedWarnings?.length ?? 0) > 0));
      if (fx.group === "openclaw") assertKnownOpenclaw("null", fx, s);
      else if (fx.group === "openclaw-precision") assertKnownPrecision("null", fx, s);
    }
    expect(nullPrototype.createChecker({ rootDir: fixturesDir, files: [] }).check().diagnostics).toEqual([]);
  });
});

describe("the prototypes on the slice", { timeout: 120_000 }, async () => {
  const { prototypes } = await loadPrototypes("all");
  for (const prototype of prototypes) {
    it(`${prototype.name}: no soundness failure, no leakage, only table codes`, () => {
      for (const fx of fixtures) {
        const checker = createCheckerFor(prototype, fx);
        const s = score(fx, fixturesDir, checker.check().diagnostics, 0);
        checker.dispose();
        if (fx.group === "openclaw-precision") {
          assertKnownPrecision(prototype.name, fx, s);
        } else if (fx.group === "openclaw") {
          // Frozen measured gaps, not a blanket expected failure. Any change fails.
          assertKnownOpenclaw(prototype.name, fx, s);
        } else {
          expect(s.misses, `${prototype.name} / ${fx.id}`).toEqual([]);
          expect(s.warningMisses, `${prototype.name} / ${fx.id} warnings`).toEqual([]);
        }
        expect(s.leakage, `${prototype.name} / ${fx.id}`).toEqual([]);
        expect(s.codeTableViolations, `${prototype.name} / ${fx.id}`).toEqual([]);
        expect(s.unmapped, `${prototype.name} / ${fx.id}`).toBe(0);
      }
    });
  }
});
