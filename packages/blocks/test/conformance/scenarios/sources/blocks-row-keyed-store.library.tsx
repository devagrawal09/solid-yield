import { $component, $event, $store, For, view } from "solid-blocks";
import { h } from "conformance";

const comments = [
  { id: 1, text: "a" },
  { id: 2, text: "b" },
  { id: 3, text: "c" }
];

export const App = $component(function* App() {
  const [closed, setClosed] = yield* $store<Record<number, boolean>>({
    1: false,
    2: false,
    3: false
  });
  return view(function* () {
    return (
      <ul>
        {
          yield* For({
            each: comments,
            children: function* (c) {
              const toggle = $event(function* () {
                const id = yield* c.id;
                h.run("toggle " + id);
                yield* setClosed(s => {
                  s[id] = !s[id];
                });
              });
              return view(function* () {
                return (
                  <li class={"c" + (yield* c.id)} onClick={yield* toggle}>
                    {yield* c.text}:{(yield* closed[yield* c.id]) ? "closed" : "open"}
                  </li>
                );
              });
            }
          })
        }
      </ul>
    );
  });
});
