// Reduced from ui/src/lib/reactive/context.ts:16–29,105–107; extensions/clawrouter/src/control-ui.tsx:26–49; D-128 platform-symbol rule
// A service get method is not intrinsic Map.get — mutant. See README.md and D-131 for the frozen scope.
import { createContext, useContext } from "solid-js";
import { render } from "@solidjs/web";
function makeApi() { return { get(): string { throw new RangeError("denied"); } }; }
const Api = createContext<ReturnType<typeof makeApi>>();
function Child() { const api = useContext(Api); return <button onClick={() => { api.get(); }}>Read</button>; }
function App() { return <Api value={makeApi()}><Child /></Api>; }

render(App, document.body);
