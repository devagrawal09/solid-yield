// Reduced from ui/src/lib/solid/presentation.ts:1–4; ui/src/components/session-progress-card-content.tsx:21 @09e09dcdf71
// A default context accessor is copied, not evaluated, by lookup — control. See README.md and D-131 for the frozen scope.
import { createContext, useContext, createSignal, type Accessor } from "solid-js";
import { render } from "@solidjs/web";
const Presented = createContext<Accessor<boolean>>(() => true);
function Child() { const read = useContext(Presented); return <p>{read() ? "shown" : "hidden"}</p>; }
function App() { const [visible] = createSignal(true); return <Presented value={visible}><Child /></Presented>; }

render(App, document.body);
