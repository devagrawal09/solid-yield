// documentation/getting-started.md's "Flow controls and events" and "Events,
// transactions and in-flight state" behave as the guide says.
import { flush } from "solid-js";
import { $event, $signal, attempt, component, perform, render, view } from "solid-yield";
import { Page } from "./reference.js";

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const settle = async (ms = 40) => {
  await wait(ms);
  flush();
  await wait(0);
  flush();
};

let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.appendChild(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
});
const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
const $$ = (s: string) => [...root.querySelectorAll<HTMLElement>(s)].map(e => e.textContent);
function type(text: string) {
  const input = root.querySelector("input")!;
  input.value = text;
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
}
function submit(): Event {
  const event = new Event("submit", { cancelable: true });
  $("form").dispatchEvent(event);
  return event;
}

describe("the reference examples", () => {
  it("For, Show, Switch / Match, Loading, Errored and an event prop", async () => {
    dispose = render(Page, root);
    flush();
    expect($$(".loading")).toEqual(["loading…", "loading…"]);
    await settle();
    // For: a row per item
    expect($$(".note")).toEqual(["milk", "eggs"]);
    // Errored: the typed failure, its message
    expect($(".load-failed").textContent).toContain("no folder trash");
    // Switch / Match
    expect($(".status").textContent).toBe("saved");
    // Show with a condition: the fallback
    expect(root.textContent).toContain("not saved yet");
    // the event prop: ThemePicker calls the parent's handler
    expect($(".theme").textContent).toBe("light");
    $(".theme").click();
    await settle(0);
    expect($(".theme").textContent).toBe("dark");
  });

  it("the form: preventDefault is synchronous, $optimistic shows the save in flight, Show takes the failure", async () => {
    dispose = render(Page, root);
    flush();
    type("ab");
    flush();
    const event = submit();
    // the body ran up to its first wait inside the dispatch
    expect(event.defaultPrevented).toBe(true);
    flush();
    // the optimistic value shows at once
    expect($("button[type=submit]").textContent).toBe("Saving…");
    expect(($("button[type=submit]") as HTMLButtonElement).disabled).toBe(true);
    await settle();
    // and reverts when the event settles; the absorbed failure is shown by a row
    expect($("button[type=submit]").textContent).toBe("Save");
    expect($(".failure").textContent).toBe("too short");
    type("abc");
    flush();
    submit();
    await settle();
    expect($(".saved").textContent).toBe("saved: abc");
    expect(root.querySelector(".failure")).toBe(null);
  });
});

describe("an $event is one transaction", () => {
  it("its writes are held until it settles: a $signal set before a wait never shows", async () => {
    const seen: boolean[] = [];
    const Saver = component(function* Saver() {
      const [saving, setSaving] = yield* $signal(false);
      const save = $event(function* () {
        yield* setSaving(true);
        // the event reads what was there before it: its own write is held too
        seen.push(yield* saving);
        yield* attempt(
          () => wait(20),
          () => {}
        );
        yield* setSaving(false);
      });
      return view(function* () {
        return <button onClick={perform(save)}>{perform(saving) ? "Saving…" : "Save"}</button>;
      });
    });
    dispose = render(Saver, root);
    flush();
    $("button").click();
    flush();
    expect($("button").textContent).toBe("Save");
    await wait(5);
    flush();
    expect($("button").textContent).toBe("Save");
    await settle();
    expect($("button").textContent).toBe("Save");
    expect(seen).toEqual([false]);
  });

  it("a synchronous event's writes commit by the next microtask: an event dispatched in the same task reads the values before it", async () => {
    const read: string[] = [];
    const Form = component(function* Form() {
      const [title, setTitle] = yield* $signal("old");
      const edit = $event(function* (e: InputEvent & { currentTarget: HTMLInputElement }) {
        yield* setTitle(e.currentTarget.value);
      });
      const save = $event(function* (e: SubmitEvent) {
        e.preventDefault();
        read.push(yield* title);
      });
      return view(function* () {
        return (
          <form onSubmit={perform(save)}>
            <input value={perform(title)} onInput={perform(edit)} />
          </form>
        );
      });
    });
    dispose = render(Form, root);
    flush();
    type("new");
    submit(); // same task: the input's write is not committed yet
    await Promise.resolve();
    submit(); // a microtask later: it is
    await settle(0);
    expect(read).toEqual(["old", "new"]);
  });
});
