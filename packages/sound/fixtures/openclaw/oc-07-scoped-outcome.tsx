// Reduced from ui/src/pages/question/question-page.tsx:51–62,202–211;
// ui/src/pages/chat/components/chat-question-resource.tsx:55,325–328 @09e09dcdf71.
// Fulfilled owner outcome, then observation failure; the child owns its boundary.
import { createMemo, Loading, Errored } from "solid-js";
import { render } from "@solidjs/web";
function completed(): Promise<{ error: string | null }> { return Promise.resolve({ error: "unavailable" }); }
function Child(props: { value: string }) { return <Errored fallback={() => <p>failed</p>}><Loading fallback={<p>waiting</p>}><p>{props.value}</p></Loading></Errored>; }
function App() {
  const outcome = createMemo(() => completed());
  const read = createMemo(() => {
    const result = outcome();
    if (result.error) throw new Error(result.error);
    return "ready";
  });
  return <Child value={read()} />;
}
render(App, document.body);
