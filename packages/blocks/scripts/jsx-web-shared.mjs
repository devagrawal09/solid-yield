#!/usr/bin/env node
// After jsx-sync: the brands that libraries attach to @solidjs/web's JSX
// namespace must be web's own, not a copy. `SerializableAttributeValue` is
// branded with a unique symbol, so the generated namespace's copy made every
// web-typed serializable value (the router's `action()` in <form action>, its
// typed paths in <a href>) unassignable in block JSX. It is re-declared here
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
// a block component (branded) is called, never tagged (D-062).
const namespace = "export namespace JSX {\n";
if (!source.includes(namespace)) throw new Error("jsx-web-shared: JSX namespace not found");
const importLine = 'import type { Element as BlocksElement } from "@solidjs/blocks";';
if (!source.includes(importLine)) throw new Error("jsx-web-shared: blocks import not found");
fs.writeFileSync(
  file,
  source
    .replace(
      copy,
      '  /** @solidjs/web\'s own (libraries brand values with it). */\n  type SerializableAttributeValue = import("@solidjs/web").JSX.SerializableAttributeValue;\n'
    )
    .replace(
      importLine,
      'import type { Element as BlocksElement, TagType as BlocksTagType } from "@solidjs/blocks";'
    )
    .replace(
      namespace,
      namespace +
        "  /** D-067: a DOM element or a foreign component; a block component is called (D-062). */\n  type ElementType = BlocksTagType;\n"
    )
);
