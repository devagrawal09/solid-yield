// Browser script for scripts/example-blocks/browser.mjs (CSR build). A fake
// clock, a scripted `Math.random` (the mock API fails a save below 0.33;
// new ids use it too) and a seeded localStorage make both apps identical.
export const mode = "static";
export const clock = true;
export const root = "#root";

export async function init(page) {
  await page.addInitScript(() => {
    window.__random = 0.9;
    Math.random = () => window.__random;
    if (!sessionStorage.getItem("seeded")) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem(
        "TODOS",
        JSON.stringify([
          { id: "1700000000000-a", title: "write routines", completed: false },
          { id: "1700000000001-b", title: "ship routines", completed: true }
        ])
      );
    }
  });
}

const run = ms => page => page.clock.runFor(ms);
const settle = run(1000);
const add = title => async page => {
  await page.fill(".new-todo", title);
  await page.press(".new-todo", "Enter");
  await page.clock.runFor(1);
};
const click = selector => async page => {
  await page.click(selector);
  await page.clock.runFor(1);
};
// A hash link: the browser fires `hashchange` as a task of its own.
const filter = href => async page => {
  await page.click(`a[href="${href}"]`);
  await page.waitForFunction(h => location.hash === h, href === "#/" ? "#/" : href);
  await page.waitForTimeout(50);
  await page.clock.runFor(1);
};
const random = r => page => page.evaluate(v => (window.__random = v), r);

export const steps = [
  [
    "load",
    async (page, { base }) => {
      await page.goto(base + "/");
      await page.clock.runFor(500);
    }
  ],
  ["add a todo (optimistic)", add("write the linker")],
  ["add settles", settle],
  ["toggle the first", click("li.todo >> nth=0 >> .toggle")],
  ["toggle settles", settle],
  ["filter: active", filter("#/active")],
  ["filter: completed", filter("#/completed")],
  ["filter: all", filter("#/")],
  ["toggle all", click("#toggle-all")],
  ["toggle all settles", settle],
  [
    "failing save",
    async page => {
      await random(0.1)(page);
      await click("li.todo >> nth=1 >> .toggle")(page);
    }
  ],
  ["failure shows a retry", settle],
  [
    "retry",
    async page => {
      await random(0.9)(page);
      await click("button.retry")(page);
    }
  ],
  ["retry settles", settle],
  ["clear completed", click("button.clear-completed")],
  ["clear settles", settle]
];
