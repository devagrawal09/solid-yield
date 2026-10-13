/** Pin the compiler's actual messages, not just the shape of a refusal alias. */
import ts from "typescript";
import { resolve } from "node:path";

it("four beginner mistakes lead with readable type messages", () => {
  const configPath = resolve("tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve("."));
  const file = resolve("test/type-message-fixture.tsx");
  const text = `
    import {component, view, $event, $effect, For} from "solid-yield";
    const C = component(function* () {return view(function* () {return <p/>; }); });
    const tag = <C/>;
    const unbound = $event(function* () {});
    const event = <button onClick={unbound}/>;
    $effect(function* () {});
    For({each: [1], children: function* (item) { return <p>{yield* item}</p>; }});
  `;
  const host = ts.createCompilerHost(options);
  const read = host.readFile;
  host.readFile = name => (name === file ? text : read(name));
  const exists = host.fileExists;
  host.fileExists = name => name === file || exists(name);
  const program = ts.createProgram([file], options, host);
  const diagnostics = program.getSemanticDiagnostics(program.getSourceFile(file));
  const messages = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(messages).toHaveLength(4);
  expect(messages[0]).toContain(
    "[COMPONENT_TAG] call a yield component in a hole: {yield* Comp(props)}"
  );
  expect(messages[1]).toContain(
    "[UNBOUND_EVENT] bind the event in the view: onClick={yield* handler}"
  );
  expect(messages[2]).toContain(
    "[EFFECT_PHASES] $effect takes two functions: a tracked compute and an untracked effect"
  );
  expect(messages[3]).toContain(
    "[ROW_VIEW] a row returns its view: return view(function* () { return <.../>; })"
  );
  expect(diagnostics.some(d => d.code === 2589)).toBe(false);
});

it("D-118's refusals lead with readable type messages", () => {
  const configPath = resolve("tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve("."));
  const file = resolve("test/type-message-fixture-d118.tsx");
  const text = `
    import {component, view, $event, $signal, $slot, compose, createSlot, render, type Handler, type Part, type Path, type Props} from "solid-yield";
    const Pick = component(function* Pick(props: Props<{ onPick: Handler }>) { return view(function* () { return <p/>; }); });
    const Host = component(function* Host() {
      const pick = $event(function* () {});
      const [held] = yield* $signal(pick);
      return view(function* () { return <>{yield* Pick({ onPick: held })}</>; });
    });
    type Optional = Props<{ onPick?: Handler }>;
    type S = { n: number };
    const Slot = createSlot<Part<S>, "NSlot">({ name: "NSlot" });
    const Reader = component(function* Reader() { const s = yield* $slot(Slot); return view(function* () { return <i>{yield* s.at.n}</i>; }); });
    render(Reader, document.body);
    const Other = createSlot<{ at: Path<S> }, "Other">({ name: "Other" });
    compose({ n: { init: (): S => ({ n: 0 }), slot: Other } });
  `;
  const host = ts.createCompilerHost(options);
  const read = host.readFile;
  host.readFile = name => (name === file ? text : read(name));
  const exists = host.fileExists;
  host.fileExists = name => name === file || exists(name);
  const program = ts.createProgram([file], options, host);
  const diagnostics = program.getSemanticDiagnostics(program.getSourceFile(file));
  const messages = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(messages).toHaveLength(4);
  expect(messages[0]).toContain(
    "[HANDLER_PROP] prop `onPick` is an event handler: pass an $event, not a source or a hole"
  );
  expect(messages[1]).toContain(
    "[OPTIONAL_HANDLER] an event-handler prop is required (it is held, not read)"
  );
  expect(messages[2]).toContain("[NO_PROVIDER]");
  expect(messages[2]).toContain('"NSlot"');
  expect(messages[3]).toContain("[SLOT_PART] entry `n`'s slot must carry its part");
  expect(diagnostics.some(d => d.code === 2589)).toBe(false);
});
