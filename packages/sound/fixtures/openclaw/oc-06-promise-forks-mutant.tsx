// Reduced from ui/src/pages/chat/components/chat-question-resource.tsx:185–199 @09e09dcdf71 (#180630)
// Catching the transport promise does not catch a derived rejection branch — mutant. See README.md and D-131 for the frozen scope.
import { render } from "@solidjs/web";
async function write(): Promise<void> { throw new Error("write failed"); }
function App() {
  return <button onClick={() => {
    const transport = write();
    const presentation = transport.then(() => undefined);
    void transport.catch(() => {});
    void presentation;
  }}>Save</button>;
}

render(App, document.body);
