const test = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { makeService, root } = require("./helpers.cjs");

for (const binding of ["attribute", "spread"]) {
  const event = handler =>
    binding === "attribute" ? "onClick={" + handler + "}" : "{...{onClick: " + handler + "}}";
  const item =
    "function Item(props: {todo: {id: string}}) {return <button " +
    event("() => console.log(props.todo.id)") +
    "/>;}";
  const main =
    'import {render} from "@solidjs/web";import {App} from "./app";render(() => <App/>, document.body);';

  test("native " + binding + ": settled generic prop reads do not reject events", () => {
    const { service } = makeService({
      "app.tsx":
        'import {createSignal,For} from "solid-js";' +
        item +
        'export function App(){const [todos]=createSignal([{id:"one"}]);return <For each={todos()}>{todo => <Item todo={todo}/>}</For>;}',
      "main.tsx": main
    });
    try {
      assert.deepEqual(
        ["app.tsx", "main.tsx"].flatMap(file => service.diagnostics(join(root, file))),
        []
      );
    } finally {
      service.dispose();
    }
  });

  test("native " + binding + ": failing generic inputs retain their root failure", () => {
    const { service } = makeService({
      "app.tsx":
        'import {createMemo} from "solid-js";' +
        item +
        'export function App(){const todo=createMemo(() => JSON.parse("{}") as {id:string});return <Item todo={todo()}/>;}',
      "main.tsx": main
    });
    try {
      const messages = ["app.tsx", "main.tsx"]
        .flatMap(file => service.diagnostics(join(root, file)))
        .map(d => d.messageText);
      assert.ok(
        messages.some(
          message => message.startsWith("[FOREIGN_HANDOFF]") && /SyntaxError/.test(message)
        ),
        JSON.stringify(messages)
      );
      assert.ok(
        messages.every(message => message.startsWith("[FOREIGN_HANDOFF]")),
        JSON.stringify(messages)
      );
    } finally {
      service.dispose();
    }
  });

  test("native " + binding + ": concrete handler failures are still rejected", () => {
    const { service } = makeService({
      "app.tsx": "export function App(){return <button " + event('() => JSON.parse("{}")') + "/>;}"
    });
    try {
      const messages = service.diagnostics(join(root, "app.tsx")).map(d => d.messageText);
      assert.equal(messages.length, 1, JSON.stringify(messages));
      assert.match(messages[0], /^\[EVENT_REJECTS\].*SyntaxError/);
    } finally {
      service.dispose();
    }
  });

  test("native " + binding + ": generic failures do not hide concrete union members", () => {
    const { service } = makeService({
      "app.tsx":
        'import {createSignal,For} from "solid-js";function Item(props: {todo: {id: string}}){return <button ' +
        event('() => {console.log(props.todo.id); return JSON.parse("{}");}') +
        '/>;}export function App(){const [todos]=createSignal([{id:"one"}]);return <For each={todos()}>{todo => <Item todo={todo}/>}</For>;}'
    });
    try {
      const messages = service.diagnostics(join(root, "app.tsx")).map(d => d.messageText);
      assert.ok(
        messages.some(
          message => /^\[EVENT_REJECTS\].*SyntaxError/.test(message) && /\b_E_todo\b/.test(message)
        ),
        JSON.stringify(messages)
      );
    } finally {
      service.dispose();
    }
  });
}
