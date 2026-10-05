import {
  $component,
  $event,
  For,
  Show,
  view,
  type ChildView,
  type Create,
  type Element,
  type Path,
  type Read,
  type ViewFn
} from "solid-blocks";
import { h } from "conformance";

interface TreeNode {
  id: number;
  label: string;
  kids: TreeNode[];
}

const tree: TreeNode[] = [
  { id: 1, label: "a", kids: [{ id: 2, label: "a1", kids: [{ id: 3, label: "a1x", kids: [] }] }] },
  { id: 4, label: "b", kids: [] }
];

export const App = $component(function* App() {
  // a named row declared in the setup, rendering itself for its children; a
  // recursive function needs its return type written, here a settled row
  function* node(
    n: Path<TreeNode>
  ): Generator<
    Create<"signal">,
    ViewFn<Read<false, never> | ChildView<false, never>, Element>,
    unknown
  > {
    const label = h.peek<string>(n.label);
    const [open, setOpen] = yield* h.$signal("open " + label, true);
    const toggle = $event(function* () {
      yield* setOpen(!(yield* open));
    });
    return view(function* () {
      return (
        <li class={"n" + (yield* n.id)}>
          <span>{yield* n.label}</span>
          {
            yield* Show({
              when: n.kids.length,
              children: function* () {
                return (
                  <>
                    <a class={"t" + (yield* n.id)} onClick={yield* toggle}>
                      {(yield* open) ? "[-]" : "[+]"}
                    </a>
                    <ul style={{ display: (yield* open) ? "block" : "none" }}>
                      {yield* For({ each: n.kids, children: node })}
                    </ul>
                  </>
                );
              }
            })
          }
        </li>
      );
    });
  }
  return view(function* () {
    return <ul class="tree">{yield* For({ each: tree, children: node })}</ul>;
  });
});
