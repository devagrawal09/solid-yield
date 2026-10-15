import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { trimNavigationHistory, cleanupSample } from "./sample-cleanup.mjs";
const require = createRequire(import.meta.url);
const vitestRequire = createRequire(require.resolve("vitest/package.json"));
const mocks = await import(pathToFileURL(vitestRequire.resolve("@vitest/spy")).href);

test("200 rounds release old navigation entries while preserving URL, state and new navigation", () => {
  const dom = new JSDOM("", { url: "https://soak.test/" });
  const { window } = dom;
  try {
    for (let round = 0; round < 200; round++) {
      window.history.pushState({ round }, "", `/room?round=${round}`);
      window.location.hash = "active";
      const url = window.location.href,
        state = window.history.state;
      assert.ok(window.history.length > 1);
      trimNavigationHistory(window);
      assert.equal(window.history.length, 1);
      assert.equal(window.location.href, url);
      assert.deepEqual(window.history.state, state);
    }
    window.history.pushState({ done: true }, "", "/done");
    assert.equal(window.history.length, 2);
    assert.deepEqual(window.history.state, { done: true });
  } finally {
    window.close();
  }
});

test("200 samples release spy calls and settled responses without changing the mock", async () => {
  const dom = new JSDOM("", { url: "https://soak.test/" });
  const fetch = mocks.fn(async value => ({ value }));
  try {
    for (let round = 0; round < 200; round++) {
      assert.deepEqual(await fetch(round), { value: round });
      assert.equal(fetch.mock.settledResults.length, 1);
      cleanupSample(dom.window, mocks);
      assert.equal(fetch.mock.calls.length, 0);
      assert.equal(fetch.mock.results.length, 0);
      assert.equal(fetch.mock.settledResults.length, 0);
      assert.equal(dom.window.history.length, 1);
    }
    await fetch("keep");
    dom.window.history.pushState({}, "", "/keep");
    cleanupSample(dom.window, mocks, { SOAK_CLEAR_MOCKS: "0", SOAK_KEEP_HISTORY: "1" });
    assert.equal(fetch.mock.settledResults.length, 1);
    assert.equal(dom.window.history.length, 2);
  } finally {
    mocks.clearAllMocks();
    dom.window.close();
  }
});
