// Reduced from ui/src/plugins/control-ui-dashboard.tsx:168–176; ui/src/features/github-connections/github-identity-view.tsx:53–78; CONTEXT.md lazy-unconsumed rule
// A lazy prop expression has no read until a child consumes it — mutant. See README.md and D-131 for the frozen scope.
import { createMemo } from "solid-js";
import { render } from "@solidjs/web";
function Child(props: { value: string }) { return <p>{props.value}</p>; }
function App() { const read = createMemo<string>(() => { throw new Error("unused"); }); return <Child value={read()} />; }

render(App, document.body);
