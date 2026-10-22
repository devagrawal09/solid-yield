// Reduced from ui/src/components/portaled-hovercard-focus.ts:47–51; notes/repros/zz-scratch-ctx.test.ts:17–26
// null is a usable optional-context default; undefined is not — mutant. See README.md and D-131 for the frozen scope.
import { createContext, useContext } from "solid-js";
import { render } from "@solidjs/web";
const Optional = createContext<string | undefined>(undefined);
function App() { const value = useContext(Optional); return <p>{value ?? "none"}</p>; }

render(App, document.body);
