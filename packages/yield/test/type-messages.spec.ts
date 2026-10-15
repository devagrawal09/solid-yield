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

it("D-126's refusals lead with readable type messages", () => {
  const configPath = resolve("tsconfig.json");
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve("."));
  const file = resolve("test/type-message-fixture-d118.tsx");
  const text = `
    import {component, view, $event, $signal, constant, createContext, type Handler, type Props, type Source} from "solid-yield";
    const Pick = component(function* Pick(props: Props<{ onPick: Handler }>) { return view(function* () { return <p/>; }); });
    const Room = component(function* Room(props: Props<{ room: string }>) { return view(function* () { return <p>{props.room}</p>; }); });
    const Count = component(function* Count(props: Props<{ n: Source<number> }>) { return view(function* () { return <p>{yield* props.n}</p>; }); });
    declare const pending: Source<number, never, true>;
    const Held = createContext<string, "Held">(undefined, { name: "Held" });
    const Live = createContext<Source<string>, "Live">(undefined, { name: "Live" });
    const Host = component(function* Host() {
      const pick = $event(function* () {});
      const [held] = yield* $signal(pick);
      const [room] = yield* $signal("lobby");
      return view(function* () {
        return <>
          {yield* Pick({ onPick: held })}
          {yield* Room({ room })}
          {yield* Count({ n: 1 })}
          {yield* Count({ n: pending })}
          {yield* Held.provide({ value: room, children: function* () { return <i/>; } })}
          {yield* Live.provide({ value: "x", children: function* () { return <i/>; } })}
        </>;
      });
    });
    void [Host, constant];
  `;
  const host = ts.createCompilerHost(options);
  const read = host.readFile;
  host.readFile = name => (name === file ? text : read(name));
  const exists = host.fileExists;
  host.fileExists = name => name === file || exists(name);
  const program = ts.createProgram([file], options, host);
  const diagnostics = program.getSemanticDiagnostics(program.getSourceFile(file));
  const messages = diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
  expect(messages).toHaveLength(6);
  expect(messages[0]).toContain(
    "[HANDLER_PROP] prop `onPick` is an event handler: pass an $event, not a source or a hole"
  );
  expect(messages[1]).toContain(
    "[HELD_PROP] prop `room` is held as a value: declare it Source<…> to pass a live one"
  );
  expect(messages[2]).toContain(
    "[REACTIVE_PROP] prop `n` is reactive and settled: pass a settled source, path or hole (constant(v) for a fixed value), or declare it Source<T, E, true>"
  );
  expect(messages[3]).toContain("[REACTIVE_PROP] prop `n` is reactive and settled");
  expect(messages[4]).toContain(
    "[HELD_PROP] prop `value` is held as a value: declare the context Source<T> to provide a live one"
  );
  expect(messages[5]).toContain(
    "[REACTIVE_PROP] prop `value` is reactive: pass a source, a path or a hole (constant(v) for a fixed value)"
  );
  expect(diagnostics.some(d => d.code === 2589)).toBe(false);
});
