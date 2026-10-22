// Reduced from ui/src/components/solid/settings-ui.tsx:432–451 @e6ec3895402 (#179453); ui/src/pages/question/question-page.tsx:268–281
// Key-function For row callback setup versus JSX — mutant. See README.md and D-131 for the frozen scope.
import { createSignal, For } from "solid-js";
import { render } from "@solidjs/web";
function App() { const [rows] = createSignal([{ id: "a", label: "A" }]);
  return <For each={rows()} keyed={row => row.id}>{row => {
    const initial = row().label;
    return <p>{initial}</p>;
  }}</For>;
}

render(App, document.body);
