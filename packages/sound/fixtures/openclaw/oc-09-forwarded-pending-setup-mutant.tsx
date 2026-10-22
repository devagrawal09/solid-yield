// Reduced from ui/src/features/github-connections/github-identity-view.tsx:54–78; ui/src/pages/model-setup/native-model-setup.tsx:79–81 @09e09dcdf71
// A helper cannot turn a pending prop into a setup snapshot — mutant. See README.md and D-131 for the frozen scope.
import { createMemo, Loading } from "solid-js";
import { render } from "@solidjs/web";
function label(value: string) { return value.toUpperCase(); }
function Child(props: { value: string }) { const initial = label(props.value); return <p>{initial}</p>; }
function App() { const read = createMemo(() => Promise.resolve("ready")); return <Loading><Child value={read()} /></Loading>; }

render(App, document.body);
