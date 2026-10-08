// Steps inside a block keep their authored order: selectors depend on earlier steps.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
export function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function shuffle(blocks, random) {
  const out = blocks.map(x => [...x]);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.flat();
}
export function schedule(twin, random, round, scenario = "all") {
  if (scenario !== "all") {
    if (!twin.startsWith("effect")) throw new Error("Reduced scenarios require effect-yield");
    if (scenario === "search") return [9, ...shuffle([range(1, 9), range(10, 14)], random), 15];
    if (scenario === "retry") return [9, ...range(10, 14), 15];
    if (scenario === "retry-fail") return [9, 10, 11, 12, 15];
    if (scenario === "switch") return [9, 10, 12];
    if (scenario === "idle") return [0];
    if (scenario === "supersede") return [...range(1, 9), 15];
    if (scenario === "checkout") return [...range(16, 35)];
    throw new Error(`Unknown reduced scenario ${scenario}`);
  }
  if (twin.startsWith("todos"))
    return [
      "todos-start",
      ...shuffle([range(4, 5), range(6, 8), range(9, 12), range(13, 16), range(17, 20)], random),
      "todos-end"
    ];
  if (twin.startsWith("sierpinski"))
    return [0, 1, ...shuffle([range(2, 3), [4, 6], [5], range(7, 8), range(9, 10)], random)];
  if (twin.startsWith("docs"))
    return [
      "docs-home",
      ...range(0, 5),
      ...shuffle([[6], range(7, 8), range(9, 12), range(13, 18), [19], range(20, 21)], random),
      22,
      23
    ];
  if (twin.startsWith("effect"))
    return [34, 35, ...shuffle([range(1, 9), range(10, 14)], random), 15, ...range(16, 35)];
  if (twin.startsWith("hackernews"))
    return [
      14,
      ...shuffle(
        [[1, 2, 14], [3, 14], [4, 14], range(5, 10).concat(14), range(11, 13).concat(14)],
        random
      )
    ];
  if (twin.startsWith("rendering"))
    return [
      ...shuffle(
        [range(2, 3), range(4, 10), range(11, 13), range(14, 17), range(18, 22), range(23, 26)],
        random
      ),
      27,
      28
    ];
  if (twin.startsWith("room"))
    return [
      ...shuffle(
        [
          ["room-switch", 1, 2, 3, ...range(4, 6)],
          ["room-switch", 1, 2, 3, ...range(7, 10)]
        ],
        random
      ),
      "room-switch",
      12
    ];
  throw new Error(`No soak schedule for ${twin}/${round}`);
}
