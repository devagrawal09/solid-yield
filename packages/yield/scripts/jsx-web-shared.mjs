#!/usr/bin/env node
// After jsx-sync: the brands that libraries attach to @solidjs/web's JSX
// namespace must be web's own, not a copy. `SerializableAttributeValue` is
// branded with a unique symbol, so the generated namespace's copy made every
// web-typed serializable value (the router's `action()` in <form action>, its
// typed paths in <a href>) unassignable in routine JSX. It is re-declared here
// as an alias of web's.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../jsx/jsx.d.ts");
const source = fs.readFileSync(file, "utf8");
const copy =
  /  const SERIALIZABLE: unique symbol;\n  interface SerializableAttributeValue \{\n    toString\(\): string;\n    \[SERIALIZABLE\]: never;\n  \}\n/;
if (!copy.test(source))
  throw new Error("jsx-web-shared: SerializableAttributeValue declaration not found");
// D-067: a JSX tag names a DOM element or a foreign (plain-Solid) component;
// a yield component (branded) is called, never tagged (D-062).
const namespace = "export namespace JSX {\n";
if (!source.includes(namespace)) throw new Error("jsx-web-shared: JSX namespace not found");
const importLine = 'import type { Element as YieldElement } from "solid-yield";';
if (!source.includes(importLine)) throw new Error("jsx-web-shared: solid-yield import not found");
// D-072: an event attribute takes a bound `$event` handler — `onClick={yield*
// save}`, whose failures (and may-wait marker, D-075) the view's type carries — and nothing
// else: an unbound handler, a plain function or a source's value would be called
// by the DOM with its colors in no type (D-071).
const eventUnion =
  /  interface BoundEventHandler<\n    T,\n    E extends Event,\n    EHandler extends EventHandler<T, any> = EventHandler<T, E>\n  > \{\n    0: \(data: any, \.\.\.e: Parameters<EHandler>\) => void;\n    1: any;\n  \}\n  type EventHandlerUnion<\n    T,\n    E extends Event,\n    EHandler extends EventHandler<T, any> = EventHandler<T, E>\n  > = EHandler \| BoundEventHandler<T, E, EHandler>;\n/;
if (!eventUnion.test(source))
  throw new Error("jsx-web-shared: EventHandlerUnion declaration not found");
fs.writeFileSync(
  file,
  source
    .replace(
      copy,
      '  /** @solidjs/web\'s own (libraries brand values with it). */\n  type SerializableAttributeValue = import("@solidjs/web").JSX.SerializableAttributeValue;\n'
    )
    .replace(
      importLine,
      () =>
        'import type {\n  Bound as YieldBound,\n  Element as YieldElement,\n  TagType as YieldTagType\n} from "solid-yield";'
    )
    .replace(
      eventUnion,
      () =>
        "  /** D-072: the bound-data form, `onClick={[yield* pick, data]}`: Solid calls `pick(data, event)`. */\n" +
        "  interface BoundEventHandler<\n    T,\n    E extends Event,\n    EHandler extends EventHandler<T, any> = EventHandler<T, E>\n  > {\n" +
        "    0: YieldBound<(data: any, ...e: Parameters<EHandler>) => void>;\n    1: any;\n  }\n" +
        "  /**\n   * D-072: an event attribute takes a bound `$event` handler, `onClick={yield* save}`:\n" +
        "   * its failures (and may-wait marker, D-075) are the view's. Not an unbound handler, a plain\n" +
        "   * function or a source's value: the DOM would call it with its colors in no type (D-071).\n   */\n" +
        "  type EventHandlerUnion<\n    T,\n    E extends Event,\n    EHandler extends EventHandler<T, any> = EventHandler<T, E>\n  > = YieldBound<EHandler> | BoundEventHandler<T, E, EHandler>;\n"
    )
    .replace(
      namespace,
      namespace +
        "  /** D-067: a DOM element or a foreign component; a yield component is called (D-062). */\n  type ElementType = YieldTagType;\n"
    )
);
