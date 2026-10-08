import { test } from "node:test";
import assert from "node:assert/strict";
import { slope, trends } from "./analysis.mjs";
import { seeded, schedule } from "./schedule.mjs";
test("least-squares fit distinguishes retained growth from bounded oscillation", () => {
  const samples = Array.from({ length: 100 }, (_, round) => ({
    round,
    heap: 30e6 + round * 100000,
    roots: 1,
    boundaries: 3,
    routines: 10 + round,
    domNodes: 20 + (round % 2),
    pendingPromises: 0,
    eventsInFlight: 0,
    eventQueueDepth: 0
  }));
  assert.equal(slope(samples, "heap"), 100000);
  const fits = trends(samples);
  assert.equal(fits.heap.flagged, true);
  assert.equal(fits.routines.flagged, true);
  assert.equal(fits.domNodes.flagged, false);
  assert.equal(fits.roots.flagged, false);
});
test("slope needs enough samples and material retained growth", () => {
  const samples = Array.from({ length: 8 }, (_, round) => ({
    round,
    heap: 10e6 + round * 100000,
    roots: 1,
    boundaries: 0,
    routines: 0,
    domNodes: 10,
    pendingPromises: 0,
    eventsInFlight: 0,
    eventQueueDepth: 0
  }));
  assert.equal(trends(samples).heap.flagged, false);
});
test("seed reproduces block order and keeps required step pairs together", () => {
  const a = seeded(109),
    b = seeded(109),
    c = seeded(110);
  const orders = Array.from({ length: 10 }, (_, i) => schedule("rendering-yield", a, i));
  assert.deepEqual(
    orders,
    Array.from({ length: 10 }, (_, i) => schedule("rendering-yield", b, i))
  );
  assert.notDeepEqual(
    orders,
    Array.from({ length: 10 }, (_, i) => schedule("rendering-yield", c, i))
  );
  for (const order of orders) {
    assert.equal(order.indexOf(3), order.indexOf(2) + 1);
    assert.equal(order.indexOf(26), order.indexOf(23) + 3);
  }
});
