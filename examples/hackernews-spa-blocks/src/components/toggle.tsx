import { $component, $event, $signal, type Element, type Props, view } from "solid-blocks";

// A comment's collapse toggle: its own state (a `$signal`), its handler an
// `$event`.
const Toggle = $component(function* Toggle(props: Props<{ children: Element }>) {
  const [open, setOpen] = yield* $signal(true);
  const toggle = $event(function* () {
    yield* setOpen(o => !o);
  });
  return view(function* () {
    return (
      <>
        <div class={["toggle", { open: yield* open }]}>
          <a onClick={toggle}>{(yield* open) ? "[-]" : "[+] comments collapsed"}</a>
        </div>
        <ul class="comment-children" style={{ display: (yield* open) ? "block" : "none" }}>
          {yield* props.children}
        </ul>
      </>
    );
  });
});

export default Toggle;
