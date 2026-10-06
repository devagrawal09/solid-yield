// Browser script for scripts/example-blocks/browser.mjs, one run per build:
//
//   node scripts/example-blocks/browser.mjs rendering --variant csr
//   node scripts/example-blocks/browser.mjs rendering --variant stream
//   node scripts/example-blocks/browser.mjs rendering --variant string
//
// Build first: `pnpm csr:build && pnpm stream:build && pnpm string:build` in
// both examples (the twin's `pnpm build` does all three). The page clock is
// installed paused, so the app's timers (the Home ticker, the simulated
// fetches) advance only by the script's `runFor`; the servers' own delays
// (streamed routes) are real and awaited.
export const root = "body";
// `createUniqueId()` values (Settings' label/input pair) are compared as
// they are: the owner tree is the original's.
export const clock = true;

export const variants = {
  csr: { mode: "static", dist: "csr/dist" },
  stream: { mode: "server", server: "stream/server.js" },
  string: { mode: "server", server: "string/server.js" }
};

const run = ms => page => page.clock.runFor(ms);
// A client navigation loads the route's lazy chunk over the network (real
// time) inside a transition: wait until the tab is selected, then advance the
// page clock.
// A client navigation loads the route's lazy chunk over the network (real
// time) inside a transition that may also wait on the page's (paused) timers:
// step the clock until the tab is selected. The clock time this takes is the
// same for both apps, so their snapshots stay comparable.
async function until(page, predicate, arg) {
  for (let i = 0; i < 300; i++) {
    if (await page.evaluate(predicate, arg)) return;
    await page.waitForTimeout(20);
    if (i % 5 === 4) await page.clock.runFor(50);
  }
  throw new Error("condition never held");
}
const nav =
  (label, ms = 50) =>
  async page => {
    await page.getByRole("link", { name: label, exact: true }).click();
    await until(
      page,
      text => document.querySelector("ul.inline li.selected a")?.textContent === text,
      label
    );
    await page.clock.runFor(ms);
  };
const load =
  path =>
  async (page, { base }) => {
    await page.goto(base + path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(300);
    await page.clock.runFor(50);
  };

export const steps = [
  ["load /", load("/")],
  ["Home ticks", run(1000)],
  ["Profile (client nav)", nav("Profile")],
  ["user lands", run(450)],
  ["info lands", run(450)],
  ["Settings", nav("Settings")],
  [
    "type",
    async page => {
      await page.fill('input[type="text"]', "Hello yield");
      await page.clock.runFor(10);
    }
  ],
  [
    "close the portal",
    async page => {
      await page.getByRole("button", { name: "Close portal" }).click();
      await page.clock.runFor(10);
    }
  ],
  [
    "open it and count a click",
    async page => {
      await page.getByRole("button", { name: "Open body portal" }).click();
      await page.click(".modal-card h2");
      await page.clock.runFor(10);
    }
  ],
  [
    "close it again",
    async page => {
      await page.getByRole("button", { name: "Close portal" }).click();
      await page.clock.runFor(10);
    }
  ],
  ["Stream", nav("Stream")],
  ["two items", run(2100)],
  ["all items", run(3200)],
  ["Error Stream", nav("Error Stream")],
  ["items settle / fail", run(1600)],
  [
    "reset the inner bad item",
    async page => {
      await page.getByRole("button", { name: "Reset to valid item" }).first().click();
      await page.clock.runFor(1600);
    }
  ],
  ["Reveal", nav("Reveal")],
  ["cards reveal", run(1800)],
  [
    "order: together, restart",
    async page => {
      await page.check('input[value="together"]');
      await page.getByRole("button", { name: "Restart run" }).click();
      await page.clock.runFor(1800);
    }
  ],
  ["Skeleton", nav("Skeleton")],
  ["feed lands", run(1300)],
  [
    "refetch",
    async page => {
      await page.getByRole("button", { name: "Refetch" }).click();
      await page.clock.runFor(1300);
    }
  ],
  ["Home again", nav("Home", 500)],
  ["load /profile", load("/profile")],
  ["profile settles", run(900)],
  ["load /settings", load("/settings")],
  ["load /error-stream", load("/error-stream")],
  ["error-stream settles", run(1600)],
  ["load /reveal", load("/reveal")],
  ["reveal settles", run(1800)],
  ["load /skeleton", load("/skeleton")],
  ["skeleton settles", run(1300)],
  ["load /stream", load("/stream")],
  ["stream settles", run(5500)]
];
