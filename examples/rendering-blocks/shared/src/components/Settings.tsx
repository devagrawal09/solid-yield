import { createUniqueId } from "solid-js";
import { Portal } from "@solidjs/web";
import { $component, $event, $signal, view } from "solid-blocks";

type Input = InputEvent & { currentTarget: HTMLInputElement };

const Settings = $component(function* Settings() {
  const [text, setText] = yield* $signal("Hi");
  const [modalOpen, setModalOpen] = yield* $signal(true);
  const [modalClicks, setModalClicks] = yield* $signal(0);
  const id = createUniqueId();

  // Clicks inside the portal bubble here through the component tree.
  const count = $event(function* () {
    if (yield* modalOpen) yield* setModalClicks(c => c + 1);
  });
  const input = $event(function* (e: Input) {
    yield* setText(e.currentTarget.value);
  });
  const open = $event(function* () {
    yield* setModalOpen(true);
  });
  const close = $event(function* () {
    yield* setModalOpen(false);
  });

  return view(function* () {
    return (
      <section onClick={count}>
        <h1>Settings</h1>
        <p>All that configuration you never really ever want to look at.</p>
        <label for={id}>Write:</label>
        <input type="text" id={id} value={yield* text} onInput={input} />
        <p>{yield* text}</p>
        <button type="button" onClick={open}>
          Open body portal
        </button>
        <p>Portal logical clicks: {yield* modalClicks}</p>
        {(yield* modalOpen) && (
          <Portal>
            <div class="modal-backdrop">
              <div class="modal-card" role="dialog" aria-modal="true" aria-label="Settings portal">
                <h2>Body Portal</h2>
                <p>This modal is portaled to document.body.</p>
                <button type="button" onClick={close}>
                  Close portal
                </button>
              </div>
            </div>
          </Portal>
        )}
      </section>
    );
  });
});

export default Settings;
