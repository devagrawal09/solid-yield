import { render } from "@solidjs/web";
import { createSignal } from "solid-js";

interface Item {
  slug: string;
  favorited: boolean;
}

function Preview(props: { item: Item }) {
  const [last, setLast] = createSignal("");
  return (
    <button
      onClick={() => {
        const item = props.item;
        if (item.favorited) setLast(`unfavorite ${item.slug}`);
        else setLast(`favorite ${item.slug}`);
      }}
    >
      {last()}
    </button>
  );
}

function App() {
  return <Preview item={{ slug: "a", favorited: false }} />;
}
render(() => <App />, document.body);
