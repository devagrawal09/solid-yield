// The native language surface: each JavaScript and TypeScript form a
// component's code is written in, placed in each host a Solid program puts
// code in, with what native mode must say about it. A form reads reactive
// state inside its construct and hands a value to `sink`; the read variant
// keeps it (`seen.push`), the write variant writes a signal there (`setOut`).
// Expected outcomes are plain Solid's: a read is reactive in JSX, a memo, an
// effect or an event and lost in the component body (READ_IN_SETUP); a write
// belongs in an event or an effect's phase and never where Solid tracks
// (WRITE_IN_REACTIVE).

/** @typedef {{ n: string, items: string, maybe: string, obj: string, store: string, sink: (x: string) => string }} Slots */
/** @typedef {{ id: string, body: (s: Slots) => string, expr?: (s: Slots) => string, throws?: boolean, note?: string }} Form */

/** @type {Form[]} */
export const forms = [
  { id: "plain", body: s => s.sink(`${s.n} + 1`), expr: s => `${s.n} + 1` },
  {
    id: "ternary",
    body: s => s.sink(`${s.n} > 1 ? "big" : "small"`),
    expr: s => `${s.n} > 1 ? "big" : "small"`
  },
  { id: "logical-and", body: s => s.sink(`${s.n} > 1 && "big"`), expr: s => `${s.n} > 1 && "big"` },
  { id: "logical-or", body: s => s.sink(`${s.n} || 7`), expr: s => `${s.n} || 7` },
  { id: "nullish", body: s => s.sink(`${s.maybe} ?? 0`), expr: s => `${s.maybe} ?? 0` },
  {
    id: "optional-chain",
    body: s => s.sink(`${s.obj}?.inner?.value`),
    expr: s => `${s.obj}?.inner?.value`
  },
  { id: "template", body: s => s.sink("`n=${" + s.n + "}`"), expr: s => "`n=${" + s.n + "}`" },
  {
    id: "tagged-template",
    body: s =>
      `const tag = (parts: TemplateStringsArray, ...values: unknown[]) => parts.join(String(values.length));\n${s.sink("tag`a${" + s.n + "}b`")}`
  },
  {
    id: "array-literal",
    body: s => s.sink(`[${s.n}, ${s.n} * 2]`),
    expr: s => `[${s.n}, ${s.n} * 2].join()`
  },
  {
    id: "object-literal",
    body: s => s.sink(`{ a: ${s.n}, b: [${s.n}] }`),
    expr: s => `Object.keys({ a: ${s.n}, b: [${s.n}] }).length`
  },
  {
    id: "array-spread",
    body: s => s.sink(`[...${s.items}, ${s.n}]`),
    expr: s => `[...${s.items}, ${s.n}].length`
  },
  {
    id: "object-spread",
    body: s => s.sink(`{ ...${s.obj}, extra: ${s.n} }`),
    expr: s => `Object.keys({ ...${s.obj}, extra: ${s.n} }).length`
  },
  {
    id: "destructure-object",
    body: s => `const { inner, label } = ${s.obj};\n${s.sink("inner.value + label")}`
  },
  {
    id: "destructure-array",
    body: s => `const [first, ...rest] = ${s.items};\n${s.sink("first + rest.length")}`
  },
  {
    id: "destructure-default",
    body: s => `const { missing = ${s.n} } = {} as { missing?: number };\n${s.sink("missing")}`
  },
  {
    id: "map",
    body: s => s.sink(`${s.items}.map(x => x * ${s.n})`),
    expr: s => `${s.items}.map(x => x * ${s.n}).join()`
  },
  {
    id: "filter",
    body: s => s.sink(`${s.items}.filter(x => x > ${s.n})`),
    expr: s => `${s.items}.filter(x => x > ${s.n}).length`
  },
  {
    id: "reduce",
    body: s => s.sink(`${s.items}.reduce((a, x) => a + x, ${s.n})`),
    expr: s => `${s.items}.reduce((a, x) => a + x, ${s.n})`
  },
  {
    id: "find",
    body: s => s.sink(`${s.items}.find(x => x === ${s.n}) ?? -1`),
    expr: s => `${s.items}.find(x => x === ${s.n}) ?? -1`
  },
  {
    id: "some-every",
    body: s => s.sink(`${s.items}.some(x => x > ${s.n}) && ${s.items}.every(x => x > 0)`)
  },
  { id: "sort-copy", body: s => s.sink(`[...${s.items}].sort((a, b) => (a - b) * ${s.n})`) },
  { id: "for-each", body: s => `${s.items}.forEach(x => {\n${s.sink(`x + ${s.n}`)}\n});` },
  { id: "for-of", body: s => `for (const x of ${s.items}) {\n${s.sink(`x * ${s.n}`)}\n}` },
  {
    id: "for-in",
    body: s => `for (const key in ${s.obj}) {\n${s.sink("key")}\n}`
  },
  { id: "for-index", body: s => `for (let i = 0; i < ${s.n}; i++) {\n${s.sink("i")}\n}` },
  { id: "while", body: s => `let i = 0;\nwhile (i < ${s.n}) {\n${s.sink("i")}\ni++;\n}` },
  { id: "do-while", body: s => `let i = 0;\ndo {\n${s.sink("i")}\ni++;\n} while (i < ${s.n});` },
  {
    id: "labeled-continue",
    body: s =>
      `outer: for (const x of ${s.items}) {\nfor (const y of ${s.items}) {\nif (y > ${s.n}) continue outer;\n${s.sink("x + y")}\n}\n}`
  },
  {
    id: "switch",
    body: s =>
      `switch (${s.n}) {\ncase 1:\n${s.sink('"one"')}\nbreak;\ndefault:\n${s.sink('"many"')}\n}`
  },
  {
    id: "if-else",
    body: s =>
      `if (${s.n} > 2) {\n${s.sink("2")}\n} else if (${s.n} > 1) {\n${s.sink("1")}\n} else {\n${s.sink("0")}\n}`
  },
  {
    id: "try-catch",
    body: s =>
      `try {\n${s.sink(`JSON.parse(String(${s.n}))`)}\n} catch {\n/* @yield-absorb: a number always parses */\n${s.sink("-1")}\n}`
  },
  {
    id: "try-finally",
    body: s =>
      `let done = false;\ntry {\n${s.sink(`${s.n} * 3`)}\n} finally {\ndone = true;\n}\nvoid done;`
  },
  { id: "iife", body: s => s.sink(`(() => ${s.n} * 2)()`), expr: s => `(() => ${s.n} * 2)()` },
  {
    id: "local-arrow",
    body: s => `const twice = (x: number) => x * 2;\n${s.sink(`twice(${s.n})`)}`,
    expr: s => `((x: number) => x * 2)(${s.n})`
  },
  {
    id: "local-function",
    body: s => `function square(x: number) {\nreturn x * x;\n}\n${s.sink(`square(${s.n})`)}`
  },
  {
    id: "closure-read",
    note: "the read is in a local closure the host calls at once",
    body: s => `const get = () => ${s.n};\n${s.sink("get() + 1")}`
  },
  {
    id: "typeof-instanceof",
    body: s => s.sink(`typeof ${s.n} === "number" && ${s.items} instanceof Array ? 1 : 0`),
    expr: s => `typeof ${s.n} === "number" && ${s.items} instanceof Array ? 1 : 0`
  },
  {
    id: "in-operator",
    body: s => s.sink(`"inner" in ${s.obj} ? 1 : 0`),
    expr: s => `"inner" in ${s.obj} ? 1 : 0`
  },
  {
    id: "casts",
    body: s => s.sink(`((${s.maybe} ?? 0) as number) satisfies number`),
    expr: s => `(${s.maybe}! as number) satisfies number`
  },
  {
    id: "string-methods",
    body: s => s.sink(`String(${s.n}).padStart(3, "0").toUpperCase()`),
    expr: s => `String(${s.n}).padStart(3, "0")`
  },
  {
    id: "math",
    body: s => s.sink(`Math.max(${s.n}, ...${s.items})`),
    expr: s => `Math.max(${s.n}, ...${s.items})`
  },
  {
    id: "object-statics",
    body: s => s.sink(`Object.entries(${s.obj}).length + Object.keys(${s.store}.user).length`)
  },
  { id: "map-set", body: s => s.sink(`new Set(${s.items}).size + new Map([[${s.n}, 1]]).size`) },
  {
    id: "date",
    body: s => s.sink(`new Date(${s.n}).getTime()`),
    expr: s => `new Date(${s.n}).getTime()`
  },
  {
    id: "regex",
    body: s => s.sink(`/\\d/.test(String(${s.n}))`),
    expr: s => `/\\d/.test(String(${s.n}))`
  },
  {
    id: "optional-call",
    body: s =>
      `const fn = ${s.n} > 0 ? (x: number) => x : undefined;\n${s.sink(`fn?.(${s.n}) ?? 0`)}`
  },
  {
    id: "compound-assign",
    body: s =>
      `let v: number | undefined = 1;\nv *= ${s.n};\nv ??= 0;\nv += ${s.items}.length;\n${s.sink("v")}`
  },
  { id: "increment", body: s => `let v = ${s.n};\nv++;\n--v;\n${s.sink("v")}` },
  {
    id: "exponent-bitwise",
    body: s => s.sink(`(${s.n} ** 2) | 0`),
    expr: s => `(${s.n} ** 2) | 0`
  },
  // BigInt of a fraction throws a RangeError: an event must catch it
  { id: "bigint", throws: true, body: s => s.sink(`(BigInt(${s.n}) * 2n).toString()`) },
  {
    id: "string-concat",
    body: s => s.sink(`"a" + ${s.n} + ${s.obj}.label`),
    expr: s => `"a" + ${s.n}`
  },
  {
    id: "array-from",
    body: s => s.sink(`Array.from({ length: ${s.n} }, (_, i) => i)`),
    expr: s => `Array.from({ length: ${s.n} }, (_, i) => i).length`
  },
  {
    id: "store-path",
    body: s => s.sink(`${s.store}.user.name.length`),
    expr: s => `${s.store}.user.name.length`
  },
  {
    id: "store-list",
    body: s => s.sink(`${s.store}.list.filter(t => !t.done).map(t => t.title).join()`),
    expr: s => `${s.store}.list.map(t => t.title).join()`
  },
  // a cycle or a BigInt throws a TypeError
  {
    id: "json-stringify",
    throws: true,
    body: s => s.sink(`JSON.stringify(${s.obj})`),
    expr: s => `JSON.stringify(${s.obj})`
  },
  {
    id: "class-instance",
    body: s =>
      `class Box {\nconstructor(readonly x: number) {}\nget double() {\nreturn this.x * 2;\n}\n}\n${s.sink(`new Box(${s.n}).double`)}`
  },
  {
    id: "getter-object",
    note: "the read is in an object literal's getter, called at once",
    body: s => `const o = {\nget x() {\nreturn ${s.n};\n}\n};\n${s.sink("o.x")}`
  },
  {
    id: "user-generator",
    // the author's generator is opaque: what it throws is unknown
    throws: true,
    note: "the read is in the author's own generator, spread at once",
    body: s =>
      `function* counts(limit: number) {\nfor (let i = 0; i < limit; i++) yield i;\n}\n${s.sink(`[...counts(${s.n})].length`)}`
  },
  {
    id: "object-method",
    note: "the read is in an object literal's method, called at once",
    body: s => `const o = {\ntotal() {\nreturn ${s.n} + 1;\n}\n};\n${s.sink("o.total()")}`
  },
  {
    id: "getter-this",
    body: s =>
      `const o = {\nlabel: "x",\nget full() {\nreturn this.label + ${s.n};\n}\n};\n${s.sink("o.full")}`
  },
  {
    id: "class-method",
    body: s =>
      `class Counter {\nread() {\nreturn ${s.n} * 2;\n}\n}\n${s.sink("new Counter().read()")}`
  },
  {
    id: "reader-helper",
    note: "a helper hands back a reader of the accessor it is given",
    body: s => `const twice = (get: Accessor<number>) => () => get() * 2;\n${s.sink("twice(n)()")}`
  },
  {
    id: "untrack",
    body: s => s.sink(`untrack(() => ${s.n})`),
    expr: s => `untrack(() => ${s.n})`
  },
  {
    id: "comma-sequence",
    body: s => `let a = 0, b = 0;\n(a = ${s.n}), (b = a + 1);\n${s.sink("a + b")}`
  },
  {
    id: "nested-ternary-template",
    body: s =>
      s.sink("`${" + s.n + " > 2 ? `big ${" + s.n + "}` : " + s.n + " > 1 ? 'mid' : 'small'}`")
  }
];

/** Await is a form of the event host only (an async memo is its own case). */
/** @type {Form[]} */
export const eventOnly = [
  {
    id: "await",
    body: s =>
      `try {\nconst r = await fetch("/x?n=" + ${s.n});\n${s.sink("await r.text()")}\n} catch (e) {\n/* @yield-absorb: logged */\nconsole.error(e);\n}`
  },
  {
    id: "await-nested",
    body: s =>
      `try {\n${s.sink(`await (await fetch("/x?n=" + ${s.n})).text()`)}\n} catch (e) {\n/* @yield-absorb: logged */\nconsole.error(e);\n}`
  },
  {
    id: "await-json",
    body: s =>
      `try {\nconst r = await fetch("/x");\nconst data: unknown = await r.json();\n${s.sink(`JSON.stringify(data) + ${s.n}`)}\n} catch (e) {\n/* @yield-absorb: logged */\nconsole.error(e);\n}`
  },
  {
    id: "promise-then",
    body: s =>
      `void fetch("/x?n=" + ${s.n}).then(r => r.status).then(status => {\n${s.sink("status")}\n}).catch((e: unknown) => {\n/* @yield-absorb: logged */\nconsole.error(e);\n});`
  },
  {
    id: "await-loop",
    body: s =>
      `try {\nfor (const x of ${s.items}) {\nconst r = await fetch("/x?n=" + x);\n${s.sink("r.status")}\n}\n} catch (e) {\n/* @yield-absorb: logged */\nconsole.error(e);\n}`
  }
];
