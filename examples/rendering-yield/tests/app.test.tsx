// The rendering twin's shared App, client-rendered in jsdom (the CSR
// variant): the router (links, active tab, pending tab, popstate), each
// lazily loaded route and its interactions.
import App from "../shared/src/components/App";
import { advance, click, install, mount, nav, uninstall, until, type Mounted } from "./script";

let app: Mounted;
beforeEach(async () => {
  install();
  app = mount(App);
  await until(() => !!document.querySelector("h1"), "Home");
});
afterEach(() => {
  app.dispose();
  uninstall();
});

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel);
const $$ = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const tabs = () => $$("ul.inline li").map(li => li.className);

describe("rendering with solid-yield", () => {
  it("starts on Home with its ticker running", async () => {
    expect(tabs()[0]).toBe("selected");
    expect($("h1")?.textContent).toBe("Welcome to this Simple Routing Example");
    expect($("span")?.textContent).toBe("0");
    await advance(550);
    expect($("span")?.textContent).toBe("5");
  });

  it("navigates with links (pushState) and marks the tab pending meanwhile", async () => {
    const link = $$("a.link").find(a => a.textContent === "Profile")!;
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(location.pathname).toBe("/profile");
    await until(() => $("div.tab")?.className === "tab pending", "the pending tab");
    await until(() => $("ul.inline li.selected a")?.textContent === "Profile", "Profile");
    expect($("div.tab")?.className).toBe("tab");
    expect($("h1")?.textContent).toBe("Jon's Profile");
    // `info` cascades from `user`: its items land 400 ms later, under their
    // own <Loading>.
    await advance(450);
    expect(
      $$("li")
        .map(li => li.textContent)
        .slice(-3)
    ).toEqual(["Something Interesting", "Something else you might care about", "Or maybe not"]);
  });

  it("Settings: input, body portal, and logical clicks through the portal", async () => {
    await nav("Settings");
    const input = $<HTMLInputElement>('input[type="text"]')!;
    expect(input.value).toBe("Hi");
    expect($("label")?.getAttribute("for")).toBe(input.id);
    input.value = "typed";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await advance(0);
    expect($("section p:nth-of-type(2)")?.textContent).toBe("typed");
    // The portal renders into <body>, but clicks inside it bubble to the
    // section through the component tree.
    expect($("body > .modal-backdrop")).not.toBeNull();
    // (The count starts above 0 here — the original app does the same in
    // this sequence under jsdom — so the assertions are relative.)
    const clicks = () =>
      Number(/Portal logical clicks: (\d+)/.exec($("section")!.textContent!)![1]);
    const before = clicks();
    click(".modal-card h2");
    expect(clicks()).toBe(before + 1);
    click("button", "Close portal");
    expect($(".modal-backdrop")).toBeNull();
    const closed = clicks();
    click("section h1");
    expect(clicks()).toBe(closed);
  });

  it("Stream: the memo and the projection both grow one item per second", async () => {
    await nav("Stream");
    await advance(2100);
    expect($$("#memo-list li").map(li => li.textContent)).toEqual([
      "1: First item",
      "2: Second item"
    ]);
    expect($$("#proj-list li")).toHaveLength(2);
    await advance(3100);
    expect($$("#memo-list li")).toHaveLength(5);
    expect($$("#proj-list li").at(-1)?.textContent).toBe("5: Fifth item");
  });

  it("Error Stream: errors caught inside and outside Loading, and reset", async () => {
    await nav("Error Stream");
    await advance(1600);
    expect($$("div").filter(d => d.textContent === "Test Item")).toHaveLength(2);
    expect($$("button").filter(b => b.textContent === "Reset to valid item")).toHaveLength(2);
    click("button", "Reset to valid item");
    await advance(1600);
    click("button", "Reset to valid item");
    await advance(1600);
    expect($$("div").filter(d => d.textContent === "Test Item")).toHaveLength(4);
  });

  it("Reveal: cards reveal in order, and restart replays", async () => {
    await nav("Reveal");
    expect($$(".reveal-card")).toHaveLength(0);
    await advance(1800);
    expect($$(".reveal-card strong").map(s => s.textContent)).toEqual([
      "A",
      "B",
      "C",
      "Outer-1",
      "Inner-1",
      "Inner-2",
      "Outer-2"
    ]);
    expect($("p strong")?.parentElement?.textContent).toBe("Run: 1");
    click("button", "Restart run");
    expect($("p strong")?.parentElement?.textContent).toBe("Run: 2");
    expect($$(".reveal-card")).toHaveLength(0);
    // Only sequential enables `collapsed`.
    const box = $<HTMLInputElement>('input[type="checkbox"]')!;
    expect(box.disabled).toBe(false);
    const natural = $<HTMLInputElement>('input[value="natural"]')!;
    natural.checked = true;
    natural.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await advance(0);
    expect(box.disabled).toBe(true);
    expect($$("code").some(c => c.textContent === '<Reveal order="natural">')).toBe(true);
  });

  it("Skeleton: default data first, then the fetched feed; refetch dims", async () => {
    await nav("Skeleton");
    expect($$(".feed-card.provisional")).toHaveLength(2);
    expect($(".feed-card h2")?.textContent).toBe("Someone's activity");
    await advance(1300);
    expect($$(".feed-card.provisional")).toHaveLength(0);
    expect($(".feed-card h2")?.textContent).toBe("Ada's activity");
    click("button", "Refetch");
    await advance(100);
    expect($("section.feed")?.className).toBe("feed pending");
    await advance(1300);
    expect($("section.feed")?.className).toBe("feed");
  });

  it("follows popstate", async () => {
    history.replaceState(null, "", "/stream");
    window.onpopstate!.call(window, new PopStateEvent("popstate"));
    await until(() => $("ul.inline li.selected a")?.textContent === "Stream", "Stream");
    expect($("h1")?.textContent).toBe("Async Iterable Streaming");
  });
});
