// Seeded plain Solid programs for the insertion's differential check (S20):
// memos built from source reads (signals, a store's paths, an async memo that
// is pending until it settles, earlier memos), plain calls, sums, conditionals,
// `||` (its right side read only when the left is 0) and a helper that throws
// past a bound. Each memo's value crosses a child component's prop (D-119)
// inside its own Errored and Loading; four buttons write the signals and the
// store.
const PLAIN = ["inc", "dbl"];

/** mulberry32: a small deterministic generator. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One numeric expression over the sources visible to memo `index`. */
function expression(next, index, depth) {
  const pick = list => list[Math.floor(next() * list.length)];
  const sources = [
    "a()",
    "b()",
    "c()",
    "p()",
    "st.n",
    "st.list[1]",
    ...Array.from({ length: index }, (_, i) => `m${i}()`)
  ];
  if (depth === 0 || next() < 0.25)
    return next() < 0.75 ? pick(sources) : String(Math.floor(next() * 10));
  const sub = () => expression(next, index, depth - 1);
  switch (Math.floor(next() * 5)) {
    case 0:
      return `${pick(PLAIN)}(${sub()})`;
    case 1:
      return `(${sub()} + ${sub()})`;
    case 2:
      return `(${sub()} % 3 !== 0 ? ${sub()} : ${sub()})`;
    case 3:
      return `(${sub()} % 4 || ${sub()})`;
    default:
      return `fail(${sub()})`;
  }
}

/** The program for `seed`: its source and its memo count. */
export function program(seed, memos = 12) {
  const next = random(seed);
  const lines = Array.from(
    { length: memos },
    (_, i) => `  const m${i} = createMemo(() => ${expression(next, i, 3)});`
  );
  const slots = Array.from(
    { length: memos },
    (_, i) =>
      `      <li data-m="${i}">
        <Errored fallback={err => <i>{String(err())}</i>}>
          <Loading fallback={<i>…</i>}>
            <Slot value={m${i}()} />
          </Loading>
        </Errored>
      </li>`
  );
  const source = `import { createMemo, createSignal, createStore, Errored, Loading } from "solid-js";

const inc = (x: number) => x + 1;
const dbl = (x: number) => x * 2;
function fail(x: number): number {
  if (x > 40) throw new RangeError("big " + x);
  return x;
}

function Slot(props: { value: number }) {
  return <b>{props.value}</b>;
}

export function App() {
  const [a, setA] = createSignal(1),
    [b, setB] = createSignal(2),
    [c, setC] = createSignal(3);
  const [st, setSt] = createStore({ n: 4, list: [1, 2, 3] });
  const p = createMemo(async () => {
    const v = a() + c();
    await Promise.resolve();
    return v;
  });
${lines.join("\n")}
  return (
    <ul>
      <button data-w="a" onClick={() => setA(v => (v * 7 + 3) % 31)}>a</button>
      <button data-w="b" onClick={() => setB(v => (v * 5 + 1) % 23)}>b</button>
      <button data-w="c" onClick={() => setC(v => (v * 3 + 2) % 29)}>c</button>
      <button
        data-w="d"
        onClick={() =>
          setSt(s => {
            s.n = (s.n * 5 + 2) % 37;
            s.list[1] = (s.list[1] * 3 + 1) % 19;
          })
        }
      >
        d
      </button>
${slots.join("\n")}
    </ul>
  );
}
`;
  return { source, memos };
}

/** The writes for `seed`: which button each step clicks. */
export function writes(seed, steps = 12) {
  const next = random(seed ^ 0x9e3779b9);
  return Array.from({ length: steps }, () => ["a", "b", "c", "d"][Math.floor(next() * 4)]);
}
