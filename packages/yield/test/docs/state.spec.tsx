import { flush, resetErrorHalt } from "solid-js";
import { render } from "solid-yield";
import { boardWith, EffectCounter, Preferences, type Card } from "./state.js";

const tick = () => new Promise<void>(r => setTimeout(r, 0));
async function settle() {
  for (let i = 0; i < 5; i++) {
    await tick();
    flush();
  }
}
let root: HTMLDivElement;
let dispose: (() => void) | undefined;
beforeEach(() => {
  root = document.createElement("div");
  document.body.append(root);
});
afterEach(() => {
  dispose?.();
  dispose = undefined;
  root.remove();
  resetErrorHalt();
});
it("the store example writes and reads a path", () => {
  dispose = render(Preferences, root);
  flush();
  expect(root.textContent).toBe("light");
  root.querySelector("button")!.click();
  flush();
  expect(root.textContent).toBe("dark");
});
it("the effect computes from a source, then writes the DOM and a label", () => {
  dispose = render(EffectCounter, root);
  flush();
  expect(document.title).toBe("Count 0");
  expect(root.textContent).toBe("Count 0");
  root.querySelector("button")!.click();
  flush();
  expect(document.title).toBe("Count 1");
  expect(root.textContent).toBe("Count 1");
});
it("the optimistic list moves immediately and refresh reads the saved result", async () => {
  let saved: Card[] = [{ id: 1, column: "todo" }];
  let reads = 0;
  let complete!: () => void;
  const Board = boardWith({
    async readCards() {
      reads++;
      return saved.map(card => ({ ...card }));
    },
    async moveCard(id, column) {
      await new Promise<void>(r => {
        complete = r;
      });
      saved = saved.map(card => (card.id === id ? { ...card, column } : card));
    }
  });
  dispose = render(Board, root);
  flush();
  await settle();
  expect(root.querySelector("li")!.textContent).toBe("todo");
  root.querySelector<HTMLButtonElement>(".move")!.click();
  flush();
  expect(root.querySelector("li")!.textContent).toBe("done");
  complete();
  await settle();
  expect(reads).toBeGreaterThan(1);
  expect(root.querySelector("li")!.textContent).toBe("done");
});
