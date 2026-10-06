// The room twin driven through jsdom over the in-process fake wire (see
// vitest.config.ts): the live page (the original's `/` server component is
// not part of the twin, D-058), identity and presence, posting (the
// optimistic row held for the echo), the chaos switch's reconnects, the
// undeclared summary's failure and regeneration, the nested-async card, and
// the archive's room-keyed boundary.
import { flush } from "solid-js";
import App from "../src/app";
import { advance, click, install, mount, submit, type, uninstall, type Mounted } from "./script";

let app: Mounted;
function start(path: string) {
  install(path);
  app = mount(App);
}
afterEach(() => {
  app.dispose();
  uninstall();
});

const text = (selector: string) => app.root.querySelector(selector)?.textContent ?? null;
const input = () => app.root.querySelector<HTMLInputElement>(".composer input")!;

describe("/live (live data sources)", () => {
  it("presence joins once the identity exists; directory, card and archive land", async () => {
    start("/live?room=design");
    await advance(50);
    expect(text("h1")).toBe("#design");
    expect(text(".header p.muted")).toMatch(/^You are \w+-\w+, here while/);
    expect(text(".presence .count")).toBe("1");
    const entries = [...app.root.querySelectorAll(".directory li")];
    expect(entries.map(e => e.className)).toEqual(["", "current", "", ""]);
    expect(text(".side")).toContain("counting members…");
    await advance(700);
    // the directory watches every room (each entry its own connection)
    expect(entries.map(e => e.querySelector(".count-small")!.textContent)).toEqual([
      "0",
      "0",
      "0",
      "0"
    ]);
    expect([...app.root.querySelectorAll(".directory .dot-connected")]).toHaveLength(4);
    expect(text(".side")).toContain("1 member when the card was cut");
    await advance(4000);
    expect(app.root.querySelectorAll(".ticks .tick.on")).toHaveLength(8);
    expect(text(".side")).toContain("1 message ever in #design");
  });

  it("a post shows at once as pending and is held until the transcript echoes it", async () => {
    start("/live?room=design");
    await advance(50);
    await type(app, "optimistic");
    app.root
      .querySelector(".composer")!
      .dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    flush();
    const row = () => [...app.root.querySelectorAll(".transcript .messages li")].at(-1)!;
    expect(row().className).toBe("mine pending");
    expect(text(".composer .sending")).toBe("sending…");
    await advance(50);
    expect(row().className).toBe("mine");
    expect(row().querySelector(".text")!.textContent).toBe("optimistic");
    expect(app.root.querySelector(".composer .sending")).toBeNull();
  });

  it("killing the connections errors the undeclared summary; Regenerate calls again", async () => {
    start("/live?room=lobby");
    await advance(1600);
    expect(text(".side")).toContain("Finding the thread…");
    await click(app, ".chaos button");
    await advance(50);
    expect(text(".error p")).toBe("The stream died: The stream was cut off");
    // the live sources reconnected instead
    expect(text(".header .pill")).toBe("presence · connected (1 reconnect)");
    await click(app, ".error button");
    await advance(5000);
    // (the rooms are module state: whether an earlier test posted in #lobby
    // depends on the order the tests run in)
    expect(text(".side")).toMatch(
      /Attempt 2: (nobody has said anything|\d+ (person has|people have) posted)/
    );
  });

  it("switching rooms keys the archive's boundary: the new room's fallback shows at once", async () => {
    start("/live?room=design");
    await advance(4100);
    expect(text(".side")).toContain("ever in #design");
    await click(app, '.directory a[href="/live?room=infra"]');
    expect(text("h1")).toBe("#infra");
    expect(text(".side")).toContain("counting the archive (4s)…");
    await advance(4100);
    expect(text(".side")).toContain("ever in #infra");
  });
});
