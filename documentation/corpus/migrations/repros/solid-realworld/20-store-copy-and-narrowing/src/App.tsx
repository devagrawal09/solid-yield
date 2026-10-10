import { createMemo, createStore } from "solid-js";

interface Form {
  title: string;
  body: string;
}

export function Editor(props: { slug?: string }) {
  const [state, setState] = createStore<Form>({ title: "", body: "" });
  const lookup: Record<string, string> = { a: "A" };
  // 1. A repeated optional prop read narrowed by a conditional.
  const label = createMemo(() => (props.slug ? lookup[props.slug] : undefined));
  return (
    <button
      onClick={() => {
        // 2. A plain copy of the store's current values.
        const copy: Form = Object.assign({}, state);
        setState(s => {
          s.title = copy.body;
        });
      }}
    >
      {label()} {state.title}
    </button>
  );
}
