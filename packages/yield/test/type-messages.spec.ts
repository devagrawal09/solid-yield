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
