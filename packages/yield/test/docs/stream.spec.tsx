import { flush, resetErrorHalt } from "solid-js";
import { render } from "solid-yield";
import { roomWith } from "./stream.js";
const tick = () => new Promise<void>(r => setTimeout(r, 0));
async function settle() {
  for (let i = 0; i < 5; i++) {
    await tick();
    flush();
  }
}
it("the documented attempt counter reconnects the failed stream without a keyed remount", async () => {
  let subscriptions = 0;
  let closed = 0;
  const Room = roomWith(async function* (id) {
    subscriptions++;
    try {
      yield [{ text: id }];
      await tick();
      throw new Error("disconnected");
    } finally {
      closed++;
    }
  });
  const root = document.createElement("div");
  document.body.append(root);
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  let dispose: (() => void) | undefined;
  try {
    dispose = render(() => Room({ roomId: "general" }), root);
    flush();
    await settle();
    expect(subscriptions).toBe(1);
    expect(root.textContent).toContain("disconnected");
    root.querySelector("button")!.click();
    flush();
    await settle();
    expect(subscriptions).toBe(2);
    expect(closed).toBe(2);
    expect(root.textContent).toContain("Reconnect");
    expect(errors.mock.calls.flat().map(String).join("\n")).not.toContain("REACTIVITY_HALTED");
  } finally {
    dispose?.();
    root.remove();
    errors.mockRestore();
    resetErrorHalt();
  }
});
